import axios from "axios";

const BASE_URL = "";

export function getPlaylists(userId: string) {
  return axios.get(`${BASE_URL}/api/get_playlists?user_id=${userId}`);
}
