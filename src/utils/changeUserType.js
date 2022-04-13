export default function changeUserType(db, t, globalState) {
  if (globalState.user.uid) {
    if (globalState.userInfo.canHelp) {
      db.collection("users").doc(globalState.user.uid).update({
        canHelp: false,
        needsHelp: true,
      });
    } else if (globalState.userInfo.needsHelp) {
      db.collection("users").doc(globalState.user.uid).update({
        canHelp: true,
        needsHelp: false,
      });
    }
  } else {
    globalState.error.msg = t("authLoginRequired");
  }
}
