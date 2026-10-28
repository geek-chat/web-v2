/**
 * The toast that tells the user their session ended. AppBoot shows it on
 * auth:logout and WithdrawSection when a withdrawal finishes. Both use this
 * id, so when both fire (the server's ACCOUNT_WITHDRAWN frame can beat the
 * withdraw response) the later one replaces the earlier instead of stacking.
 */
export const SESSION_ENDED_TOAST_ID = "session-ended";
