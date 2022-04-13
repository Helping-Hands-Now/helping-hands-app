import React, { createContext, useReducer, useContext } from "react";

const SET_STATE = "SET_STATE";
const SET_INFO = "SET_INFO";
const SET_ERROR = "SET_ERROR";

const GlobalStateContext = createContext();

const storageId = "firebase:uid";

var initialState = {
  user: {
    uid: null,
    isAuthed: false,
    isAdmin: false,
  },
  userInfo: {
    email: "",
    checkrVerified: "",
    BGCExistingUser: "",
    checkrStage: "",
    checkrStatus: "",
    checkrInvitationUrl: "",
    firstName: "",
    lastName: "",
    gender: "",
    street: "",
    city: "",
    state: "",
    zipCode: "",
    apartment: "",
    phoneNumber: "",
    languages: "",
    photoUrl: "",
    geohash: "",
    placeId: "",
    needsHelp: false,
    canHelp: false,
    aboutUser: "",
  },
  error: {
    msg: "",
  },
};

for (let key in localStorage) {
  if (key === storageId) {
    initialState = {
      user: {
        uid: localStorage.getItem(storageId),
        isAuthed: true,
        isAdmin: false,
      },
      userInfo: {
        email: "",
        checkrVerified: "",
        BGCExistingUser: "",
        checkrStage: "",
        checkrStatus: "",
        checkrInvitationUrl: "",
        firstName: "",
        lastName: "",
        gender: "",
        street: "",
        city: "",
        state: "",
        zipCode: "",
        apartment: "",
        phoneNumber: "",
        languages: "",
        photoUrl: "",
        geohash: "",
        placeId: "",
        needsHelp: false,
        canHelp: false,
        aboutUser: "",
      },
      error: {
        msg: "",
      },
    };
  }
}

const globalStateReducer = (state, action) => {
  switch (action.type) {
    case SET_STATE:
      return {
        ...state,
        user: { ...action.payload },
      };
    case SET_INFO:
      return {
        ...state,
        userInfo: { ...action.payload },
      };
    case SET_ERROR:
      return {
        ...state,
        error: { ...action.payload },
      };
    default:
      return state;
  }
};

export const GlobalStateProvider = ({ children }) => {
  const [state, dispatch] = useReducer(globalStateReducer, initialState);

  return (
    <GlobalStateContext.Provider value={[state, dispatch]}>
      {children}
    </GlobalStateContext.Provider>
  );
};

const useGlobalState = () => {
  const [state, dispatch] = useContext(GlobalStateContext);

  const setState = ({ uid, isAuthed, isAdmin, isSuperAdmin }) => {
    dispatch({
      type: SET_STATE,
      payload: {
        uid,
        isAuthed,
        isAdmin,
        isSuperAdmin,
      },
    });
  };

  const setInfo = ({
    email,
    checkrVerified,
    BGCExistingUser,
    checkrStage,
    checkrStatus,
    checkrInvitationUrl,
    firstName,
    lastName,
    gender,
    street,
    city,
    state,
    zipCode,
    apartment,
    phoneNumber,
    languages,
    photoUrl,
    geohash,
    needsHelp,
    canHelp,
    aboutUser,
  }) => {
    dispatch({
      type: SET_INFO,
      payload: {
        email,
        checkrVerified,
        BGCExistingUser,
        checkrStage,
        checkrStatus,
        checkrInvitationUrl,
        firstName,
        lastName,
        gender,
        street,
        city,
        state,
        zipCode,
        apartment,
        phoneNumber,
        languages,
        photoUrl,
        geohash,
        needsHelp,
        canHelp,
        aboutUser,
      },
    });
  };

  const setError = ({ msg }) => {
    dispatch({
      type: SET_ERROR,
      payload: {
        msg,
      },
    });
  };

  return {
    setState,
    user: { ...state.user },
    setInfo,
    userInfo: { ...state.userInfo },
    setError,
    error: { ...state.error },
  };
};

export default useGlobalState;
