// TODO: Implement removing items from a playlist.
// TODO: Implement pausing and stopping playback.
// TODO: Implement skip to next song.
// TODO: Implement skip to previous song.

const express = require("express");
const bodyParser = require("body-parser");
const querystring = require("node:querystring");
const axios = require("axios");
const { log } = require("node:console");

const app = express();
app.set("view engine", "ejs");
app.set("views", __dirname + "/views");

app.use(bodyParser.urlencoded({ extended: true }));
app.use(express.static(__dirname + "/public"));

const client_id = "30d5140203ce42c88337910fc2b6aef1";
const client_secret = "b214294c05ef41debf2ba2f0cbc8b8c7";
const redirect_uri = "http://localhost:3000/callback";
const stateKey = "spotify_auth_state";
var back_url = "/";
let access_token = "";
let token_type = "";
let token_response = {};

var is_playing = false;

var user = {};
var playlists = {};
let playlist_id = '';
let playlist_songs = {};

app.get("/", function (req, res) {
  res.render("index.ejs");
});

app.get("/login", function (req, res) {
  var state = generateRandomString(16);
  res.cookie(stateKey, state);
  var scope = "user-read-private user-read-email playlist-read-private playlist-read-collaborative user-read-playback-state user-modify-playback-state user-read-currently-playing";

  res.redirect(
    "https://accounts.spotify.com/authorize?" +
      querystring.stringify({
        response_type: "code",
        client_id: client_id,
        scope: scope,
        redirect_uri: redirect_uri,
        state: state,
      })
  );
});

app.get("/profile", function profile(req, res) {
  try {
    res.render("profile.ejs", {
      profilePicture:
        user.images.length != 0
          ? user.images[0].url
          : "https://static8.depositphotos.com/1009634/988/v/450/depositphotos_9883921-stock-illustration-no-user-profile-picture.jpg",
      username: user.display_name,
      email: user.email,
      followers: user.followers.total,
    });
  } catch (error) {
    console.log("Cannot go to profile page. Redirecting to login page.");
    back_url = "/profile";
    res.redirect("/login");
  }
});

app.get("/callback", function (req, res) {
  const code = req.query.code || null;
  fetchData(code);
  res.redirect(back_url);
});

app.get("/playlist", async function (req, res) {

  await isPlaying();

  try {
    res.render("playlist.ejs", { items: playlists.items , is_playing: is_playing});
  } catch (error) {
    back_url = "/playlist";
    res.redirect("/login");
  }
});

app.post("/playlist", async function (req, res) {

  console.log("button is pressed");

  var playlistUri = req.body.playlist_uri;

  console.log("URI of the playlist: " + playlistUri);

  if (!is_playing) {
    await playPlaylistSongs(playlistUri);
  } else {
    await pausePlayback();
  }

  res.redirect("/playlist");

});

app.get("/playlist/:playlistID", function(req, res) {
  var playlistID = req.params.playlistID;

    // Fetch the playlist songs based on the playlistID
    fetchPlaylistSongs(playlistID)
    .then((playlistSongs) => {

      playlist_songs = playlistSongs;

      res.render("playlist_songs", { playlistSongs: playlistSongs });
    })
    .catch((error) => {
      console.log(error);
      res.redirect("/login");
    });
    
});

app.post("/playlist/:playlistID", function(req, res) {
  var playlistID = req.params.playlistID;
  var song_uri = req.body.playlist_song_button;

  if (playlist_songs) {

    const song_uris = playlist_songs.map((song) => song.track.uri);

    console.log("All URIs of the songs:", song_uris);
    console.log("URI of the song:", song_uri);

    playSong(song_uris, song_uri);
  }

})

async function fetchToken(code) {
  return axios({
    method: "post",
    url: "https://accounts.spotify.com/api/token",
    data: querystring.stringify({
      grant_type: "authorization_code",
      code: code,
      redirect_uri: redirect_uri,
    }),
    headers: {
      "content-type": "application/x-www-form-urlencoded",
      Authorization: `Basic ${new Buffer.from(
        `${client_id}:${client_secret}`
      ).toString("base64")}`,
    },
  });
}

// Gets the data for the playlist and playlist songs
async function fetchData(code) {
  fetchToken(code)
    .then((response) => {
      if (response.status === 200) {

        token_response = response.data;

        const { access_token, token_type } = token_response;
        axios
          .get("https://api.spotify.com/v1/me", {
            headers: {
              Authorization: `${token_type} ${access_token}`,
            },
          })
          .then((response) => {
            //user = `${JSON.stringify(response.data, null, 2)}`;
            user = response.data;
            userId = user.id;
          })
          .catch((error) => {
            console.log(error);
          });
        axios
          .get(`https://api.spotify.com/v1/users/${userId}/playlists`, {
            headers: {
              Authorization: `${token_type} ${access_token}`,
            },
            params: {
              limit: 50,
            },
          })
          .then((response) => {
            playlists = response.data;
            let playlist_songs_href = response.data.items[1].tracks.href; // First playlist songs.

            playlist_id = playlists.items[0].id;

            let first_playlist_uri = response.data.items[0].uri

            console.log("This is the uri: " + first_playlist_uri);

            // playSong();

            // console.log("THE PLAYLIST ID: " + playlist_id);
            // console.log("href from playslist: " + playlist_songs_href);
            // console.log(playlists.items);
          })
          .catch((error) => {
            console.log(error);
          });
      } else {
        console.log(response);
      }
    })
    .catch((error) => {
      console.log(error);
    });
}

// Fetch the playlist songs based on the playlistID, access_token, and token_type
async function fetchPlaylistSongs(playlistID) {

  const { access_token, token_type } = token_response;

  return axios
    .get(`https://api.spotify.com/v1/playlists/${playlistID}/tracks`, {
      headers: {
        Authorization: `${token_type} ${access_token}`,
      },
      params: {
        limit: 50,
      },
    })
    .then((response) => {

      playlist_songs = response.data.items;

      // console.log("href for songs: " + response.data.href);
      // console.log("name of the second track: " + playlist_songs[1].track.name);
      // console.log("All songs in the playlist: " + playlist_songs);

      return response.data.items;
    })
    .catch((error) => {
      throw error;
    });
}

async function getCurrentlyPlayingSong() {

  const { access_token, token_type } = token_response;

  const headers = {
    Authorization: `${token_type} ${access_token}`,
  };

  return axios
  .get(`https://api.spotify.com/v1/me/player`, {
    headers: headers,
    params: {
      limit: 50,
    },
  })
  .then((response) => {

  console.log(response.data.item);
    return response.data.item;
  })
  .catch((error) => {
    throw error;
  });

}

async function isPlaying() {

  const { access_token, token_type } = token_response;

  const headers = {
    Authorization: `${token_type} ${access_token}`,
  };

  return axios
  .get(`https://api.spotify.com/v1/me/player`, {
    headers: headers,
    params: {
      limit: 50,
    },
  })
  .then((response) => {
    is_playing = response.data.is_playing;
    return response.data.is_playing;
  })
  .catch((error) => {
    throw error;
  });

}


async function getDevice() {

  const { access_token, token_type } = token_response;

  const headers = {
    Authorization: `${token_type} ${access_token}`,
  };

  return axios.get('https://api.spotify.com/v1/me/player/devices', {
    headers: headers
  })
  .then((response) => {
    return response.data.devices[0];
  })
  .catch((error) => {
    throw error;
  });
}

async function playPlaylistSongs(playlist_uri) {

  const { access_token, token_type } = token_response;

  const headers = {
    Authorization: `${token_type} ${access_token}`,
  };

  const data = {
    "context_uri": playlist_uri,
    "offset": {
        "position": 0
    },
  };

  if (!is_playing) {
    return axios.put(`https://api.spotify.com/v1/me/player/play`, data, {
      headers: headers,
      params: {
        limit: 50,
      },
    })
    .then((response) => {
      return response.data;
    })
    .catch((error) => {
      throw error;
    });
  }

}

async function playSong(playlist_song_uris, song_uri) {
  const { access_token, token_type } = token_response;

  const headers = {
    Authorization: `${token_type} ${access_token}`,
  };

  const data = {
    "offset": {
      "uri": song_uri
    },
    "uris": playlist_song_uris
  };

  return axios.put(`https://api.spotify.com/v1/me/player/play`, data, {
    headers: headers,
    params: {
      limit: 50,
    },
  })
  .then((response) => {
    return response.data;
  })
  .catch((error) => {
    throw error;
  });
}

async function pausePlayback() {
  const { access_token, token_type } = token_response;

  const headers = {
    Authorization: `${token_type} ${access_token}`,
  };

  console.log("paused song");

  if (is_playing) {
    return axios.put('https://api.spotify.com/v1/me/player/pause', null, {
      headers: headers,
      params: {
        limit: 50,
      },
    });
  }

}


app.listen(3000, function () {
  console.log("Server started on port 3000");
});

const generateRandomString = (length) => {
  let result = "";
  const characters =
    "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789";
  const charactersLength = characters.length;
  for (let i = 0; i < length; i++) {
    result += characters.charAt(Math.floor(Math.random() * charactersLength));
  }
  return result;
};
