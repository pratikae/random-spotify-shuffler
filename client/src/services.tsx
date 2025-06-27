import axios from "axios";

const BASE_URL = "http://localhost:8888";

export function getPlaylists(userId: string) {
  return axios.get(`${BASE_URL}/api/get_playlists?user_id=${userId}`);
}
