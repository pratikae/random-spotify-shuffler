import axios from "axios";

const BASE_URL = "http://localhost:8888";

export const getPlaylists = (userId) =>
  axios.get(`${BASE_URL}/api/playlists`, {
    params: { user_id: userId },
  });

export const getSavedSongs = (userId) =>
  axios.get(`${BASE_URL}/api/saved_songs`, {
    params: { user_id: userId },
  });