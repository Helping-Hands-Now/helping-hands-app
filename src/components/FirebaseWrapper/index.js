import React, { useEffect, useState, useRef } from "react";
import "semantic-ui-css/semantic.min.css";
import { Menu, Icon } from "semantic-ui-react";
import "./styles.css";
import useGlobalState from "../../hooks/useGlobalState";
import firebase, { db } from "../../firebase";
import UIButton from "../UI/UIButton";
import {
  BrowserRouter as Router,
  Switch,
  Route,
  Link,
  NavLink,
  Redirect,
} from "react-router-dom";
import { useTranslation } from "react-i18next";
import { useHistory } from "react-router-dom";
import { useMediaQuery } from "react-responsive";
import GA from "../../utils/GoogleAnalytics";

// Stripe imports
import { Elements } from "@stripe/react-stripe-js";
import { loadStripe } from "@stripe/stripe-js";

import { ReactSVG } from "react-svg";
import errorHandler from "../../errorHandler";

// Component imports
import Home from "../Home";
import Donate from "../Donate";
import GiveHelp from "../GiveHelp";
import HelperBoard from "../HelperBoard";
import Dashboard from "../Dashboard";
import AdminConsole from "../AdminConsole";
import AuthBtn from "../AuthBtn";
import Profile from "../Profile";
import About from "../About";
import PartnerWithUs from "../PartnerWithUs";
import CommunityProtocols from "../CommunityProtocols";
import EnterpriseConsole from "../EnterpriseConsole";
import PartnerConsole from "../PartnerConsole";
import TermsOfService from "../TermsOfService";
import Privacy from "../Privacy";
import Footer from "../Footer";
import ErrorModal from "../ErrorModal";
import SwitchAuthModal from "../SwitchAuthModal";
import HowItWorks from "../HowItWorks";
import ContactUs from "../ContactUs";
import AdminRequestList from "../AdminRequestList";

import HHC_HELP_CENTER_LINK from "../../utils/constants";

// SVG imports
import logomark from "../../svgs/Logomark.svg";
import requestingHelpSofa from "../../svgs/requestingHelpSofaSmall.svg";

function Nav(props) {
  const globalState = useGlobalState();
  const { t } = useTranslation();
  const history = useHistory();

  /**
   * Hook that alerts clicks outside of the passed ref
   */
  const useOutsideAlerter = (ref) => {
    useEffect(() => {
      /**
       * Alert if clicked on outside of element
       */
      function handleClickOutside(event) {
        if (ref.current && !ref.current.contains(event.target)) {
          toggleProfileDropdown(false);
        }
      }

      // Bind the event listener
      document.addEventListener("mousedown", handleClickOutside);
      return () => {
        // Unbind the event listener on clean up
        document.removeEventListener("mousedown", handleClickOutside);
      };
    }, [ref]);
  };

  const wrapperRef = useRef(null);
  useOutsideAlerter(wrapperRef);

  const [showAboutDropDown, setShowAboutDropDown] = useState(false);
  const [isProfileDropdownOpen, toggleProfileDropdown] = useState(false);

  const isMobile = useMediaQuery({ query: "(max-width: 980px) " });
  const isBannerVisible = false; // Temporary banner - see HH-344

  const donationsEnabled = true;

  useEffect(() => {}, [props.menuExpanded]);

  const toDonatePage = () => {
    history.push("/donate");
    props.closeMenu();
  };

  return isMobile ? (
    <div>
      {/* Extra AuthBtn added to fix a mobile bug (#209) */}
      <AuthBtn hidden />
      <div className="mobileMenu">
        <div className="mobileBar">
          <div className="mobileLogo">
            {globalState.user.isAuthed ? (
              <Link
                onClick={props.closeMenu}
                className="logoMenuItem"
                to="/home">
                <ReactSVG src={logomark} className="menuLogo" />
              </Link>
            ) : (
              <Link onClick={props.closeMenu} className="logoMenuItem" to="/">
                <ReactSVG src={logomark} className="menuLogo" />
              </Link>
            )}
          </div>
          <div className="mobileLoginBtn">
            {!globalState.user.isAuthed && (
              <AuthBtn clearState={props.reRender} />
            )}
          </div>

          <div className="expandIcon">
            {props.menuExpanded ? (
              <Icon
                padded
                className="expandIcon"
                onClick={props.closeMenu}
                name="close"
              />
            ) : (
              <Icon
                padded
                className="expandIcon"
                onClick={props.openMenu}
                name="bars"
              />
            )}
          </div>
        </div>
      </div>

      {props.menuExpanded && (
        <Menu vertical fluid>
          {donationsEnabled && props.path !== "/donate" && (
            <Menu.Item position="left">
              <UIButton onClick={toDonatePage} text={t("donate")} primary />
            </Menu.Item>
          )}
          <NavLink
            onClick={props.closeMenu}
            exact={true}
            activeClassName="activeMenu activeAbout"
            className="menuItem"
            to="/partner-with-us">
            {t("partnerWithUs")}
          </NavLink>
          {(!globalState.user.isAuthed ||
            (globalState.user.isAuthed && globalState.userInfo.canHelp)) && (
            <Link
              onClick={props.closeMenu}
              className={`menuItem help ${
                (props.path === "/requests" || props.path === "/volunteer") &&
                "activeMenu activeHelp"
              }`}
              to="/volunteer">
              {t("tabCanHelp")}
            </Link>
          )}

          <NavLink
            onClick={props.closeMenu}
            exact={true}
            activeClassName="activeMenu activeAbout"
            className="menuItem"
            to="/howitworks">
            {t("howItWorksLink")}
          </NavLink>
          <NavLink
            onClick={props.closeMenu}
            exact={true}
            activeClassName="activeMenu activeAbout"
            className="menuItem"
            to="/community">
            {t("communityGuidelinesLink")}
          </NavLink>
          <a className="menuItem" href={HHC_HELP_CENTER_LINK}>
            {t("faq")}
          </a>
          <NavLink
            onClick={props.closeMenu}
            exact={true}
            activeClassName="activeMenu activeAbout"
            className="menuItem"
            to="/contact">
            {t("contactUsLink")}
          </NavLink>
          <NavLink
            onClick={props.closeMenu}
            exact={true}
            activeClassName="activeMenu activeAbout"
            className="menuItem"
            to="/about">
            {t("aboutUs")}
          </NavLink>
          {globalState.user.isAuthed && (
            <Menu.Item float="right" position="right">
              <AuthBtn className="menuLogin" clearState={props.reRender} />
            </Menu.Item>
          )}
        </Menu>
      )}
      {!props.menuExpanded && isBannerVisible && (
        <div className="navBannerWrapper">
          <div className="navBannerContent">{t("banner")}</div>
        </div>
      )}
    </div>
  ) : (
    <div>
      <Menu className="navMenu" secondary>
        {globalState.user.isAuthed ? (
          <Link className="logoMenuItem" to="/home">
            <ReactSVG src={logomark} className="menuLogo" />
          </Link>
        ) : (
          <Link className="logoMenuItem" to="/">
            <ReactSVG src={logomark} className="menuLogo" />
          </Link>
        )}
        <Link
          className={`menuItem request ${
            props.path === "/partner-with-us" && "activeMenu activeRequest"
          }`}
          to="/partner-with-us">
          {t("partnerWithUs")}
        </Link>
        {(!globalState.user.isAuthed ||
          (globalState.user.isAuthed && globalState.userInfo.canHelp)) && (
          <Link
            className={`menuItem help ${
              (props.path === "/requests" || props.path === "/volunteer") &&
              "activeMenu activeHelp"
            }`}
            to="/volunteer">
            {t("tabCanHelp")}
          </Link>
        )}
        <div className="dropdown">
          <NavLink
            onClick={() => setShowAboutDropDown(!showAboutDropDown)}
            activeClassName="activeMenu activeAbout"
            className="menuItem about"
            style={{ height: "100%" }}
            to="/about">
            {t("aboutUs")}
          </NavLink>
          {showAboutDropDown && (
            <div className="dropdown-content">
              <NavLink
                exact={true}
                activeClassName="activeMenu activeAbout"
                className="menuItem"
                to="/about">
                {t("aboutUsLink")}
              </NavLink>
              <NavLink
                exact={true}
                activeClassName="activeMenu activeAbout"
                className="menuItem"
                to="/howitworks">
                {t("howItWorksLink")}
              </NavLink>
              <NavLink
                exact={true}
                activeClassName="activeMenu activeAbout"
                className="menuItem"
                to="/community">
                {t("communityGuidelinesLink")}
              </NavLink>
              <a className="menuItem" href={HHC_HELP_CENTER_LINK}>
                {t("faq")}
              </a>
              <NavLink
                exact={true}
                activeClassName="activeMenu activeAbout"
                className="menuItem"
                to="/contact">
                {t("contactUsLink")}
              </NavLink>
            </div>
          )}
        </div>

        {/* <Link
          className={`menuItem request ${
            props.path === "/partner-with-us" && "activeMenu activeRequest"
          }`}
          to="/partner-with-us">
          {t("partnerWithUs")}
        </Link> */}
        {/*donationsEnabled && props.path !== "/donate" && (
          <Menu.Item position="left">
            <UIButton
              onClick={() => history.push("/donate")}
              text={t("donate")}
              primary
            />
          </Menu.Item>
        )*/}
        <Menu.Item
          position="right"
          style={{ paddingTop: "0px", paddingBottom: "0px" }}>
          {donationsEnabled && props.path !== "/donate" && (
            <Menu.Item position="left">
              <UIButton
                onClick={() => history.push("/donate")}
                text={t("donate")}
                primaryPurple
              />
            </Menu.Item>
          )}
          <AuthBtn className="menuLogin" clearState={props.reRender} />
        </Menu.Item>
        {globalState.user.uid && (
          <div
            className="nameDropdown"
            onClick={() => toggleProfileDropdown(!isProfileDropdownOpen)}>
            <h1 className="profileDropdownText">
              {globalState.userInfo.firstName}
            </h1>
          </div>
        )}
        {isProfileDropdownOpen && (
          <div ref={wrapperRef} className="profileDropdown">
            <div className="profileOption">
              <p
                className="profileOptionLabel"
                onClick={() => {
                  history.push("/profile");
                  toggleProfileDropdown(!isProfileDropdownOpen);
                }}>
                My Profile
              </p>
            </div>
          </div>
        )}
      </Menu>
      {isMobile && <h1>Mobile</h1>}
      {isBannerVisible && (
        <div className="navBannerWrapper">
          <div className="navBannerContent">{t("banner")}</div>
        </div>
      )}
    </div>
  );
}

const stripePromise = loadStripe(firebase.options_.stripePublishableKey);

export default function FirebaseWrapper() {
  const globalState = useGlobalState();
  const [menuExpanded, setMenuExpanded] = useState(false);
  const [reRender, setShouldReRender] = useState(false);
  const [userLoading, setUserLoading] = useState(true);

  const donationsEnabled = true;

  const checkUserCanLogin = (input, callback) => {
    const uid = input.uid;
    const storageId = input.storageId;

    db.collection("users")
      .doc(uid)
      .get()
      .then((doc) => {
        if (!doc.exists) {
          // TODO handle this better?. user not logged in/or has been weirdly deleted or something
          setShouldReRender(true);
        } else {
          const data = doc.data();
          if (data.isBanned) {
            console.log("preventing banned user from logging in");
            signUserOut(storageId);
            setShouldReRender(true);
          } else {
            callback(data);
          }
        }
      });
  };

  const [switchAuth, setSwitchAuth] = useState(false);

  useEffect(() => {
    const storageId = "firebase:uid";

    const uid = localStorage.getItem(storageId);
    if (uid) {
      checkUserCanLogin(
        {
          uid: uid,
          storageId: storageId,
        },
        () => {
          globalState.setState({
            uid: localStorage.getItem(storageId),
            isAuthed: true,
          });
        }
      );
    }

    let callback = null;
    let metadataRef = null;
    firebase.auth().onAuthStateChanged(function (user) {
      // Remove previous listener.

      if (callback) {
        metadataRef.off("value", callback);
      }
      if (user) {
        errorHandler.setUser(user.uid);
        globalState.setState({
          uid: user.uid,
          isAuthed: true,
        });
        listenForUpdates(user.uid);
        checkUserCanLogin(
          {
            uid: user.uid,
            storageId: storageId,
          },
          (data) => {
            // TODO: this is a hack that is in place because of a bug with Firebase UI React,
            // where phone auth callback fails if setTimeout is caused immediately. Our workaround
            // is to delay setting global state if the user is using phone (i.e. not using email).
            const timeout = user.email ? 0 : 2000;
            // User is signed in -- make request
            setTimeout(function () {
              localStorage.setItem(storageId, user.uid);
              firebase
                .auth()
                .currentUser.getIdTokenResult(true)
                .then((idTokenResult) => {
                  saveUserInfo(user.uid, data, idTokenResult);
                  setUserLoading(false);
                })
                .catch((error) => {
                  console.log(error);
                });
            }, timeout);
            // TODO: Temporary -- TO SWITCH USERS OFF OF PHONE
            if (
              user.providerData.length === 1 &&
              user.providerData[0].providerId === "phone"
            ) {
              setTimeout(function () {
                setSwitchAuth(true);
              }, 2000);
            }
            // Check if refresh is required.
            metadataRef = firebase
              .database()
              .ref("metadata/" + user.uid + "/refreshTime");
            callback = (snapshot) => {
              // Force refresh to pick up the latest custom claims changes.
              // Note this is always triggered on first call. Further optimization could be
              // added to avoid the initial trigger when the token is issued and already contains
              // the latest claims.
              user.getIdToken(true);
            };
            // Subscribe new listener to changes on that node.
            metadataRef.on("value", callback);
          }
        );
      } else {
        // User is signed out -- auth first
        setUserLoading(false);
        clearGlobalState(storageId);
        errorHandler.setUser();
      }
    });
  }, []);

  const signUserOut = (storageId) => {
    clearGlobalState(storageId);
    firebase
      .auth()
      .signOut()
      .then(function () {
        // Sign-out successful.
      })
      .catch(function (error) {
        console.log("error", error);
        // An error happened.
      });
  };

  const clearGlobalState = (storageId) => {
    globalState.setState({
      uid: null,
      isAuthed: false,
      isAdmin: false,
      isSuperAdmin: false,
    });
    globalState.setInfo({
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
    });
    localStorage.removeItem(storageId);
  };

  const saveUserInfo = (uid, data, idTokenResult) => {
    globalState.setState({
      uid: uid,
      isAuthed: true,
      isAdmin: idTokenResult.claims.admin,
      isSuperAdmin: idTokenResult.claims.superAdmin,
    });

    globalState.setInfo({
      email: data.email,
      checkrVerified:
        data.checkrVerified === undefined ? null : data.checkrVerified,
      BGCExistingUser:
        data.BGCExistingUser === undefined ? null : data.BGCExistingUser,
      checkrStage: data.checkrStage ? data.checkrStage : null,
      checkrStatus: data.checkrStatus,
      checkrInvitationUrl: data.checkrInvitationUrl,
      firstName: data.firstName,
      lastName: data.lastName,
      gender: data.gender,
      street: data.street,
      city: data.city,
      state: data.state,
      zipCode: data.zipCode,
      apartment: data.apartment,
      phoneNumber: data.phoneNumber,
      languages: data.languages,
      photoUrl: data.photoUrl,
      geohash: data.geohash,
      placeId: data.placeId,
      needsHelp: data.needsHelp,
      canHelp: data.canHelp,
      aboutUser: data.aboutUser,
    });
  };

  const listenForUpdates = (uid) => {
    db.collection("users")
      .doc(uid)
      .onSnapshot(function (doc) {
        if (doc.exists) {
          const data = doc.data();
          globalState.setInfo({
            email: data.email,
            checkrVerified:
              data.checkrVerified === undefined ? null : data.checkrVerified,
            BGCExistingUser:
              data.BGCExistingUser === undefined ? null : data.BGCExistingUser,
            checkrStage: data.checkrStage ? data.checkrStage : null,
            checkrStatus: data.checkrStatus,
            checkrInvitationUrl: data.checkrInvitationUrl,
            firstName: data.firstName,
            lastName: data.lastName,
            gender: data.gender,
            street: data.street,
            city: data.city,
            state: data.state,
            zipCode: data.zipCode,
            apartment: data.apartment,
            phoneNumber: data.phoneNumber,
            languages: data.languages,
            photoUrl: data.photoUrl,
            geohash: data.geohash,
            placeId: data.placeId,
            needsHelp: data.needsHelp,
            canHelp: data.canHelp,
            aboutUser: data.aboutUser,
          });
        }
      });
  };
  // We wrap the entire App in Elements so that Stripe is embedded
  // See https://stripe.com/docs/payments/accept-a-payment#web for details.
  return (
    <Elements stripe={stripePromise}>
      <Router>
        {GA.init() && <GA.RouteTracker />}
        {globalState.error.msg && <ErrorModal />}
        {switchAuth && (
          <SwitchAuthModal closeCallback={() => setSwitchAuth(false)} />
        )}
        <Route
          render={({ location }) => {
            return (
              <div className="page-container">
                <div className="content-wrap">
                  <Nav
                    menuExpanded={menuExpanded}
                    openMenu={() => setMenuExpanded(true)}
                    closeMenu={() => setMenuExpanded(false)}
                    path={location.pathname}
                    reRender={reRender}
                  />
                  {!menuExpanded && (
                    <Switch>
                      {globalState.user.isAuthed && (
                        <Redirect from="/help" to="/dashboard" />
                      )}
                      {globalState.user.isAuthed && (
                        <Redirect from="/volunteer" to="/requests" />
                      )}

                      <Redirect from="/partner" to="/partner-with-us" />

                      <Route path="/volunteer">
                        <GiveHelp />
                      </Route>
                      {donationsEnabled && (
                        <Route path="/donate">
                          <Donate />
                        </Route>
                      )}
                      <Route path="/about">
                        <About />
                      </Route>
                      <Route path="/partner-with-us">
                        <PartnerWithUs />
                      </Route>
                      <Route path="/community">
                        <CommunityProtocols />
                      </Route>
                      <Route
                        path="/faq"
                        component={() => {
                          window.location.href = HHC_HELP_CENTER_LINK;
                          return null;
                        }}
                      />
                      <Route path="/howitworks">
                        <HowItWorks />
                      </Route>
                      <Route path="/contact">
                        <ContactUs />
                      </Route>
                      <Route path="/privacy">
                        <Privacy />
                      </Route>
                      <Route path="/terms">
                        <TermsOfService />
                      </Route>
                      {globalState.user.isAuthed &&
                        globalState.userInfo.canHelp && (
                          <Route path="/requests">
                            <HelperBoard />
                          </Route>
                        )}
                      {globalState.user.isAuthed &&
                        globalState.userInfo.needsHelp && (
                          <Route path="/dashboard">
                            <Dashboard />
                          </Route>
                        )}

                      {globalState.user.isAuthed && (
                        <Route path="/profile">
                          <Profile />
                        </Route>
                      )}

                      {globalState.user.isAuthed && globalState.user.isAdmin && (
                        <Route path="/admin">
                          <AdminConsole />
                        </Route>
                      )}

                      {globalState.user.isAuthed && globalState.user.isAdmin && (
                        <Route path="/adminOps">
                          <AdminRequestList />
                        </Route>
                      )}

                      {globalState.user.isAuthed && (
                        <Redirect
                          path="/community_console"
                          to="/enterprise_console"
                        />
                      )}

                      {globalState.user.isAuthed && (
                        <Route path="/enterprise_console">
                          <EnterpriseConsole />
                        </Route>
                      )}

                      {globalState.user.isAuthed && (
                        <Route path="/partner_console">
                          <PartnerConsole />
                        </Route>
                      )}

                      <Route exact path="/">
                        <Home />
                      </Route>

                      <Route path="/home">
                        <Home />
                      </Route>

                      {userLoading === false ? (
                        <Route>
                          <h1 style={{ marginLeft: "10px" }}>404 Not Found</h1>
                          <p style={{ marginLeft: "10px" }}>
                            We're sorry. The page you are looking for doesn't
                            exist.
                          </p>
                        </Route>
                      ) : null}
                    </Switch>
                  )}
                </div>
                <Footer className="footer" />
              </div>
            );
          }}
        />
      </Router>
    </Elements>
  );
}
