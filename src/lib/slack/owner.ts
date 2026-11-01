/** Only Brandon's own Slack account (Carter Home Lab) may use the Relay bot. */
export const OWNER_SLACK = { teamId: "T0CDFDW4KJ9", userId: "U0CEF41LR32" };

export function isOwnerSlackEvent(teamId: string | undefined, userId: string | undefined) {
  return teamId === OWNER_SLACK.teamId && userId === OWNER_SLACK.userId;
}
