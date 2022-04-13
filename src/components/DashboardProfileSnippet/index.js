import React, { useState, useEffect } from "react";
import { Icon, Label, Grid } from "semantic-ui-react";
import "semantic-ui-css/semantic.min.css";
import useGlobalState from "../../hooks/useGlobalState";
import { useHistory } from "react-router-dom";
import { db } from "../../firebase.js";
import "./styles.css";
import { useTranslation } from "react-i18next";
import { sendBGC, sendBGCNextStep } from "../../firebase.js";

import UIButton from "../UI/UIButton";
import { formatPhoneNumber } from "../ProfileForm";
import changeUserType from "../../utils/changeUserType";

export default function DashboardProfileSnippet(props) {
  const globalState = useGlobalState();
  const history = useHistory();

  const { t } = useTranslation();

  const phoneNumber = globalState.userInfo.phoneNumber;
  const apartment = globalState.userInfo.apartment;
  const street = globalState.userInfo.street;
  const city = globalState.userInfo.city;
  const state = globalState.userInfo.state;
  const zip = globalState.userInfo.zipCode;

  // WILL REMOVE IN
  const oneDay = 24 * 60 * 60 * 1000;
  const secondDate = new Date(2020, 8, 16);

  var [bgcSent, setBGCSent] = useState(false);

  const initiateBGC = () => {
    sendBGC()
      .then((result) => {
        setBGCSent(true);
      })
      .catch(function (error) {
        setBGCSent(false);
      });
  };

  useEffect(() => {
    if (
      props.requestsInArea > 0 &&
      globalState.userInfo.checkrVerified === false
    ) {
      sendBGCNextStep();
    }
  }, [props.requestsInArea]);

  return (
    <div>
      {globalState.userInfo.canHelp &&
        props.requestsInArea > 0 &&
        (globalState.userInfo.checkrVerified === null ||
          globalState.userInfo.checkrVerified === false) && (
          <div>
            <div className="bgcContainerExisting">
              <Grid divided="vertically" stackable>
                <Grid.Row columns={2}>
                  <Grid.Column>
                    {/*WILL REMOVE IN 14 DAYS (September 16th)*/}
                    {globalState.userInfo.checkrVerified === false &&
                      globalState.userInfo.BGCExistingUser && (
                        <div>
                          <h1 className="bgcHeaderExisting">
                            Volunteer Background Checks Required
                          </h1>
                          <h1 className="bgcSubtitleExisting">
                            Thank you for your service to the Helping Hand
                            community! In order to keep our community safe, we
                            are requiring all volunteers to complete a quick
                            background check. 95% of checks are completed within
                            5 minutes, so you should be ready to go in no time!
                          </h1>
                          <br />
                        </div>
                      )}
                    {globalState.userInfo.checkrVerified === false &&
                      !globalState.userInfo.BGCExistingUser && (
                        <div>
                          <h1 className="bgcHeaderExisting">Almost there!</h1>
                          <h1 className="bgcSubtitleExisting">
                            The final step to becoming a trusted volunteer is to
                            complete a high-level background check. This
                            important process will be conducted by email through
                            our partners at{" "}
                            <a href="https://checkr.com/" target="_blank">
                              Checkr
                            </a>{" "}
                            and ensures that our community is safe for everyone.
                            95% of background checks are completed in 5 minutes,
                            so you should be ready to go in no time!
                          </h1>
                          <br />
                        </div>
                      )}
                    {(globalState.userInfo.checkrStage === null ||
                      globalState.userInfo.checkrStage ===
                        "invitation.created" ||
                      globalState.userInfo.checkrStage ===
                        "invitation.expired") && (
                      <div>
                        {globalState.userInfo.checkrStage ===
                          "invitation.expired" && (
                          <div>
                            <Label className="checkrStatusLabel">
                              <Icon name="trash" size="big" />
                              Invitation expired
                            </Label>
                            <br />
                            <br />
                          </div>
                        )}
                        {bgcSent &&
                        (!globalState.userInfo.checkrStage ||
                          globalState.userInfo.checkrStage ===
                            "invitation.expired") ? (
                          <div className="loadingBar">
                            <div class="ui active inline loader inverted"></div>
                            <p className="barText">
                              This may take take 10-30 seconds! Thank you for
                              your patience.
                            </p>
                          </div>
                        ) : (
                          (!globalState.userInfo.checkrInvitationUrl ||
                            globalState.userInfo.checkrStage ===
                              "invitation.expired") && (
                            <UIButton
                              onClick={() => initiateBGC()}
                              text={"Request background check from Checkr"}
                              loading={bgcSent}
                              small
                            />
                          )
                        )}
                        <br />
                        {globalState.userInfo.checkrStage ===
                          "invitation.created" &&
                          globalState.userInfo.checkrInvitationUrl && (
                            <div>
                              <div className="startContainers">
                                <a
                                  href={
                                    globalState.userInfo.checkrInvitationUrl
                                  }
                                  target="_blank">
                                  <UIButton
                                    onClick={() => {}}
                                    text={"Ready to start!"}
                                    small
                                    color={"#FFF96C"}
                                  />
                                </a>
                                <h1 className="bgcSubtitleExisting emailSubtext">
                                  An email invitation has also been sent
                                </h1>
                              </div>
                              <br />
                            </div>
                          )}
                      </div>
                    )}
                    {globalState.userInfo.checkrStage ===
                      "invitation.completed" && (
                      <div>
                        <Label className="checkrStatusLabel">
                          <Icon name="check circle" size="big" />
                          Invitation completed
                        </Label>
                        <br />
                        <br />
                        <h1 className="bgcSubtitleExisting">
                          Checkr is beginning to process your information.
                        </h1>
                      </div>
                    )}
                    {globalState.userInfo.checkrStage === "report.created" && (
                      <div>
                        <Label className="checkrStatusLabel">
                          <Icon name="edit outline" size="big" />
                          Report created
                        </Label>
                        <br />
                        <br />
                        <h1 className="bgcSubtitleExisting">
                          Your background check is being processed.
                        </h1>
                      </div>
                    )}
                    {globalState.userInfo.checkrStage ===
                      "report.completed" && (
                      <div>
                        <Label className="checkrStatusLabel">
                          <Icon name="flag checkered" size="big" />
                          Report completed
                        </Label>
                        <br />
                        <br />
                        <h1 className="bgcSubtitleExisting">
                          Your background check has been processed. STATUS:{" "}
                          {globalState.userInfo.checkrStatus}
                        </h1>
                      </div>
                    )}
                    <p className="bgcSubtitleExisting">
                      More questions? check out our{" "}
                      <a
                        className="whiteLink"
                        href="https://helpinghands.community/faq">
                        Background check FAQ
                      </a>
                    </p>
                  </Grid.Column>
                  <Grid.Column></Grid.Column>
                </Grid.Row>
              </Grid>
            </div>
            {globalState.userInfo.checkrVerified === false && (
              <div>
                <div className="requestsInAreaContainer">
                  <h1 className="requestsInAreaContainerText">
                    {props.requestsInArea} people nearby need your help
                  </h1>
                </div>
                <div className="testimonialContainer">
                  <br />
                  <h1 className="testimonialHeader">Testimonials</h1>
                  <br />
                  <br />
                  <h1 className="bgcSubtitle">
                    “The delivery by Daniel was excellent. This was a
                    life-saver. She brought everything I needed. For the elderly
                    and those who are handicapped... this is phenomenal"
                  </h1>
                  <br />
                  <h1 className="bgcSubtitle" style={{ float: "right" }}>
                    - Michelle, IL
                  </h1>
                  <br />
                  <br />
                  <h1 className="bgcSubtitle">
                    "Helping Hands fills us with hope and positivity in this
                    time of fear. "
                  </h1>
                  <br />
                  <h1 className="bgcSubtitle" style={{ float: "right" }}>
                    - Cindy, NJ
                  </h1>
                  <br />
                  <br />
                </div>
              </div>
            )}
          </div>
        )}
    </div>
  );
}
