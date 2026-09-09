import apiClient from "../../../api/client";

export async function fetchTeamMembers() {
  const response = await apiClient.get(
    "/team-members",
  );

  return response.data;
}

export async function createTeamMember(data) {
  const response = await apiClient.post(
    "/team-members",
    data,
  );

  return response.data;
}
