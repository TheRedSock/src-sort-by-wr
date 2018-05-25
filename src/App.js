import React, { Component } from 'react';
import axios from 'axios';
import './App.css';

const PC_ID = '8zjwp7vo';
const WEB_ID = 'lk3g84vd';
const TIME_LOW_FILTER = 60;
const TIME_HIGH_FILTER = 300;
const YEAR_FILTER = 2013;

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

  getWorldRecord(id) {
    return axios.get(`api/v1/games/${id}/records?top=1`).then(response => {
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
        if (response.data.data.length === 0 || loop > 50000) {
          return;
        }
        loop++;

        let newGames = await Promise.all(
          response.data.data.map(async game => {
            if (game.released > YEAR_FILTER) {
              return {
                error: 'too new',
                record: {
                  time: 0
                }
              };
            }

            for (let i = 0; i < game.gametypes.length; i++) {
              if (
                game.gametypes[i] === 'go1lem4p' ||
                game.gametypes[i] === '4xm721op' ||
                game.gametypes[i] === 'v4m291qw'
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
              if (game.platforms[i] === WEB_ID) {
                return {
                  error: 'web game',
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
              released: game.released
            };
          })
        );
        let deletedArr = [];

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
              `api/v1/games?platform=${PC_ID}&max=${max}&offset=${newOffset}`,
              list,
              deleted,
              newOffset,
              max,
              loop
            );
            return;
          }
        }
      })
      .catch(err => {
        console.log(err);
      });
  }

  componentWillMount() {
    const max = 200,
      list = [],
      deleted = [],
      offset = 0;

    this.fetchGameList(
      `api/v1/games?platform=${PC_ID}&max=${max}`,
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
        Game count: {this.state.games.length} / {this.state.total}
        <br /> <br />
        {this.state.games.map(game => (
          <div key={game.id}>
            Name: {game.name} (id: {game.id}) <br />
            WR Time: {game.record.time} <br />
            Release Year: {game.released} <br />
            Player: {game.record.player}
            <br /> <br />
          </div>
        ))}
      </div>
    );
  }
}

export default App;
