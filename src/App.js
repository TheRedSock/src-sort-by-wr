import React, { Component } from 'react';
import axios from 'axios';
import './App.css';

const ID_ENUM = {
  PC : '8gej2n93',
  PS2 : 'n5e17e27',
  PS3 : 'mx6pwe3g',
  DREAMCAST : 'v06d394z',
  N3DS : 'gz9qx60q',
  NDS : '7g6m8erk',
  PSP : '5negk9y7',
  XBOX : 'jm95zz9o',
  ANDROID : 'lq60nl94',
  IOS : 'gde3xgek',
  WEB : 'o7e25xew'
}

const GAMETYPE_ENUM = {
  WEBGAME : 'go1lem4p',
  CATEGORY_EXTENSION : '53no817x',
  EXPANSION_DLC : 'j8138myw',
  FANGAME : 'd91jd1ex',
  MINIGAME_GAMEMODE : 'v31r2mkw',
  MOBILE : 'dj1gd1x5',
  SERVER_MAP : '4xm721op',
  ROMHACK : 'v4m291qw',
  PRERELEASE : 'x3n6vme4',
  MULTIGAME : 'rj1dy1o8',
  MOD : 'lyn97m9o'
}

const SEARCH_BY = ID_ENUM.PS3;

const GAMES_PER_PAGE = 50;
const WAIT_PER_GAME = 200;

const MAX_PAGES = 50000;

const TIME_LOW_FILTER = 60;
const TIME_HIGH_FILTER = 6000;
const MAX_YEAR_FILTER = 2019;

class App extends Component {
  constructor(props) {
    super(props);

    this.state = {
      games: [],
      invalid: [],
      total: 0
    };
  }

  compareTime(a, b) {
    if (a.record.time < b.record.time) return -1;
    if (a.record.time > b.record.time) return 1;
    return 0;
  }

  sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  getWorldRecord(id) {
    return axios.get(`api/v1/games/${id}/records?top=1`)
      .then(response => {
        console.log("WR Query")
        if (!response.data.data[0] || !response.data.data[0].runs[0]) {
          return {
            time: 0,
            player: 'Invalid'
          };
        } else {
          const record = response.data.data[0].runs[0].run;
          if (
            record.times.primary_t < TIME_LOW_FILTER ||
            record.times.primary_t > TIME_HIGH_FILTER
          ) {
            return {
              time: 0,
              player: 'Too fast'
            };
          }
          return {
            time: record.times.primary_t,
            player: record.players[0].id
          };
        }
      });
  }

  fetchGameList(url, list, deleted, offset, max, loop) {
    axios
      .get(url)
      .then(async response => {
        if (response.data.data.length === 0 || loop > MAX_PAGES) {
          return;
        }
        loop++;

        let newGames = await Promise.all(
          response.data.data.map(async game => {
            if (game.released > MAX_YEAR_FILTER) {
              return {
                error: 'too new',
                record: {
                  time: 0
                }
              };
            }

            for (let i = 0; i < game.gametypes.length; i++) {
              if (
                game.gametypes[i] === GAMETYPE_ENUM.WEBGAME ||
                game.gametypes[i] === GAMETYPE_ENUM.CATEGORY_EXTENSION ||
                game.gametypes[i] === GAMETYPE_ENUM.MOBILE ||
                game.gametypes[i] === GAMETYPE_ENUM.MOD ||
                game.gametypes[i] === GAMETYPE_ENUM.ROMHACK ||
                game.gametypes[i] === GAMETYPE_ENUM.SERVER_MAP ||
                game.gametypes[i] === GAMETYPE_ENUM.MINIGAME_GAMEMODE
              ) {
                return {
                  error: 'bad gametype',
                  record: {
                    time: 0
                  }
                };
              }
            }

            for (let i = 0; i < game.platforms.length; i++) {
              if (game.platforms[i] === ID_ENUM.WEB ||
                  game.platforms[i] === ID_ENUM.IOS ||
                  game.platforms[i] === ID_ENUM.ANDROID) {
                return {
                  error: 'bad platform',
                  record: {
                    time: 0
                  }
                };
              }
            }

            const record = await this.getWorldRecord(game.id);

            if (record.error) {
              return {
                error: 'invalid run',
                record: {
                  time: 0
                }
              };
            }
            return {
              id: game.id,
              record: record,
              name: game.names.international,
              released: game.released,
			  link: game.weblink
            };
          })
        );
        let deletedArr = [];
        console.log("sleeping...")
        await this.sleep(GAMES_PER_PAGE * WAIT_PER_GAME)

        for (let i = newGames.length - 1; i >= 0; i--) {
          if (newGames[i].record.time === 0) {
            deletedArr.push(newGames.splice(i, 1));
          }
        }

        list = list.concat(newGames);
        deleted = deleted.concat(deletedArr);

        list.sort(this.compareTime);

        const newState = Object.assign({}, this.state, {
          games: list,
          invalid: deleted,
          total: this.state.total + max
        });
        this.setState(newState);

        const links = response.data.pagination.links;

        for (let i = 0; i < links.length; i++) {
          if (links[i].rel === 'next') {
            const newOffset = offset + max;
            this.fetchGameList(
              `api/v1/games?platform=${SEARCH_BY}&max=${max}&offset=${newOffset}`,
              list,
              deleted,
              newOffset,
              max,
              loop
            );
            return;
          }
        }
        console.log("Finished.")
      })
      .catch(err => {
        console.log(err);
      });
  }

  componentWillMount() {
    const max = GAMES_PER_PAGE,
      list = [],
      deleted = [],
      offset = 0;

    console.log("loading first page...")

    this.fetchGameList(
      `api/v1/games?platform=${SEARCH_BY}&max=${max}`,
      list,
      deleted,
      offset,
      max,
      0
    );
  }

  render() {
    return (
      <div>
        Game count: {this.state.games.length} / ~{this.state.total}
        <br /> <br />
        {this.state.games.map(game => (
          <div key={game.id}>
            Name: {game.name} (id: {game.id}) <br />
            WR Time: {game.record.time} <br />
            Release Year: {game.released} <br />
			Link : <a href={game.link} target="_blank">Link</a> <br />
            Player: {game.record.player}
            <br /> <br />
          </div>
        ))}
      </div>
    );
  }
}

export default App;
