const fetch = require('node-fetch');
const { URLSearchParams } = require('url');
const FormData = require('form-data');
const btoa = require('btoa');
const { release } = require('os');
const { create } = require('domain');

const axios = require('axios').default;

const csv = require('csv-parser');
const fs = require('fs');
const { resolve } = require('path');


var refreshToken = 'AQCith-Na9TfyfShJ6OGd5-ColySSEfK_SNWDow00MskEhp6IzH59qzmWIR147p_d2WLSaSw8oqO3uTm2g1Ug-bxrvHD-sT0hY3tmWZiPWxB-Y76TcHko4Hajn3LYFOuKkQ'
var accessToken = '';
var authorizationCode = 'AQCEKNyFDyKFSDiIVad1aWMvSk-hC3uY3oNZStaspO4dqCtZm17DBAMyGwfJL4n_CJS0pv7nQoAQCUaICL0QYoB5zDqKBbLgm-M6s-pC4ZgVZd8-onZfnDBMrG0xkVLzfKXbpZWzSkBuiX6on_1ko9Pu05bv3QfW2fQx370YRrjdVKXI8S_611dzaGgTU3uctOyTZdX60SNGjVnVPUUiYjqM2SB46Dhn6C2uQgdK06pPXQQ3mWTajg'
var userId = 'x00yqlmjbkrs8qqlhfziwl8dz';

async function requestAccessToken() {
    let auth = await axios({
        url: 'https://accounts.spotify.com/api/token',
        method: 'POST',
        headers: { Authorization: `Basic ${btoa('46426ffa6dc8423eba91636e13a45e85:aa9a6f298136423ab0292dc44d064b5f')}`, 'Content-Type': 'application/x-www-form-urlencoded', 'Accept': 'application/json' },
        params: { "grant_type": "refresh_token", 'refresh_token': refreshToken },

    })
    accessToken = auth.data.access_token;
    console.log(accessToken);
}


async function requestRefreshToken() {
    let auth = await axios(
        {
            url: 'https://accounts.spotify.com/api/token',
            method: 'POST',
            headers: { Authorization: `Basic ${btoa('46426ffa6dc8423eba91636e13a45e85:aa9a6f298136423ab0292dc44d064b5f')}`, 'Content-Type': 'application/x-www-form-urlencoded', 'Accept': 'application/json' },
            params: { "grant_type": "authorization_code", 'code': authorizationCode, 'redirect_uri': 'http://google.com' },

        }
    );
    console.log(auth.data.refresh_token);
    refreshToken = auth.data.refresh_token;
}

async function getPlaylists() {
    let playlists = [];
    let url = 'https://api.spotify.com/v1/me/playlists';

    while (url) {
        let resp = await axios({
            url: url,
            method: 'GET',
            headers: { Authorization: `Bearer ${accessToken}` },
        })
        playlists = playlists.concat(resp.data.items);
        url = resp.data.next;
    }
    return playlists;
}

async function getTracks() {
    let tracks = [];
    let url = 'https://api.spotify.com/v1/me/tracks?limit=50';
    while (url) {
        let resp = await axios({
            url: url,
            method: 'GET',
            headers: { Authorization: `Bearer ${accessToken}`, 'Accept': 'application/json' },
        })
        tracks = tracks.concat(resp.data.items);
        url = resp.data.next;
    }
    fs.writeFileSync('tracks.json', JSON.stringify(tracks));
    return tracks;
}

async function createPlaylist(name) {
    let resp = await axios({
        url: `https://api.spotify.com/v1/users/${userId}/playlists`,
        method: 'POST',
        headers: { Authorization: `Bearer ${accessToken}`, 'Content-Type': 'application/json' },
        data: JSON.stringify({ name: name, public: false })
    })
    return resp;
}

async function getPlaylistTracks(id) {
    let playlistTracks = [];
    let url = `https://api.spotify.com/v1/playlists/${id}/tracks`
    while (url) {
        let resp = await axios({
            url: url,
            method: 'GET',
            headers: { Authorization: `Bearer ${accessToken}` },
        })
        playlistTracks = playlistTracks.concat(resp.data.items);
        url = resp.data.next;
    }
    return playlistTracks;
}

function getReleaseYear(track) {
    let releaseYear = track.track.album.release_date.split('-')[0];
    if (parseInt(releaseYear) < 2000)
        releaseYear = releaseYear.charAt(2) + '0s';
    return releaseYear;
}

async function getPlaylist(playlists, name) {
    let playlist = playlists.find((playlist) => playlist.name == name);
    if (!playlist) {
        let resp = await createPlaylist(name);
        playlist = resp.data;
        playlists.push(playlist);
    }
    return { playlists, playlist };
}

function handleTrack() {

}

async function addTracks(tracks) {
    for (let [key, value] of Object.entries(tracks)) {
        url = `https://api.spotify.com/v1/playlists/${key}/tracks`;
        let chunk = 100;
        for (let i = 0; i < value.length; i += chunk) {
            let arr = value.slice(i, i + chunk);
            let resp = await axios({
                url: url,
                method: 'POST',
                headers: { Authorization: `Bearer ${accessToken}`, 'Content-Type': 'application/json' },
                data: { uris: arr }
            })
        }


    }
}

async function sortIntoYears() {

    // await requestRefreshToken();
    await requestAccessToken();

    let tracks = await getTracks();
    let playlists = await getPlaylists();
    let tracksToAdd = {};

    for (let [idx, track] of tracks.entries()) {
        console.log(idx);
        let releaseYear = getReleaseYear(track);

        ({ playlists, playlist } = await getPlaylist(playlists, releaseYear));

        let playlistTracks = await getPlaylistTracks(playlist.id);
        let trackExists = playlistTracks.find((t) => t.track.name == track.track.name);

        if (!trackExists) {
            if (!Object.keys(tracksToAdd).includes(playlist.id)) {
                tracksToAdd[playlist.id] = [];
            }
            tracksToAdd[playlist.id].push(track.track.uri);
        }
    }

    addTracks(tracksToAdd);
}

async function readCsv(path) {
    let data = [];

    return await new Promise((resolve, reject) => {
        fs.createReadStream(path)
            .pipe(csv({ separator: ';' }))
            .on('data', (row) => {
                data.push(row);
            })
            .on('end', () => {
                resolve(data);
            })
    })
}



async function checkForMissingTracks() {

    let missingTracks = [];

    await requestAccessToken();
    // let tracks = await getTracks();
    let data = fs.readFileSync('tracks.json');
    let tracks = JSON.parse(data);

    console.log(tracks.length)
    let importedTracks = await readCsv('./tracks.csv');
    console.log(importedTracks.length)
    let titleKey = Object.keys(importedTracks[0])[0]

    for (let importedTrack of importedTracks) {
        let trackFound = false;
        for (let track of tracks) {
            let trackName = track.track.name.toLowerCase();
            let importedTrackName = importedTrack[titleKey].toLowerCase();
            let importedArtist = importedTrack.artist.toLowerCase();

            let includesArtist = track.track.artists.find((artist) => {
                let artistName = artist.name.toLowerCase();
                return (artistName.includes(importedArtist) || importedArtist.includes(artistName));
            });

            if ((trackName.includes(importedTrackName) || importedTrackName.includes(trackName)) && includesArtist) {
                trackFound = true;
                break;
            }
        }
        if (!trackFound) {
            missingTracks.push(importedTrack);
        }
    }

    fs.writeFileSync('output.json', JSON.stringify(missingTracks));


}

checkForMissingTracks();