import React from "react";
import { useMediaQuery } from "react-responsive";
import "semantic-ui-css/semantic.min.css";
import { Container } from "semantic-ui-react";

import { Trans, useTranslation } from "react-i18next";

export default function CommunityProtocols(props) {
  const { t } = useTranslation();

  const isMobile = useMediaQuery({ query: "(max-width: 767px) " });

  return (
    <div className="contentContainer">
      <Container>
        <h1 className="headPage">{t("communityGuidelines")}</h1>

        <p className="contentDesc">{t("community1")}</p>
        <h1>
          <Trans i18nKey="generalProtocol">General Protocol</Trans>
        </h1>
        <p className="contentDesc">
          <Trans i18nKey="generalProtocol1">
            When you sign up for Helping Hands Community as a volunteer, you
            will be asked to confirm that you:
          </Trans>
        </p>
        <ul>
          <li>
            <p className="contentDesc">
              <Trans i18nKey="generalProtocol2">
                Are 18 years of age or older.
              </Trans>
            </p>
          </li>
          <li>
            <p className="contentDesc">
              <Trans i18nKey="generalProtocol3">
                Have a valid driver's license and insurance.
              </Trans>
            </p>
          </li>
          <li>
            <p className="contentDesc">
              <Trans i18nKey="generalProtocol4">
                Have access to a clean vehicle to transport food and supplies to
                recipients.
              </Trans>
            </p>
          </li>
          <li>
            <p className="contentDesc">
              <Trans i18nKey="generalProtocol5">
                Use a mobile phone that can connect to a web browser and receive
                texts.
              </Trans>
            </p>
          </li>
        </ul>

        <p className="contentDesc">
          <Trans i18nKey="generalProtocol6">
            Each time that you check in for a Community Delivery event, you will
            be asked to confirm that you:
          </Trans>
        </p>
        <ul>
          <li>
            <p className="contentDesc">
              <Trans i18nKey="generalProtocol7">
                Are not exhibiting any signs of{" "}
                <a href="https://www.cdc.gov/coronavirus/2019-ncov/symptoms-testing/symptoms.html">
                  COVID-19
                </a>{" "}
                (Fever, Fatigue, Cough, Shortness of breath, Chills, etc.).
              </Trans>
            </p>
          </li>
          <li>
            <p className="contentDesc">
              <Trans i18nKey="generalProtocol8">
                Have not come in contact with anyone currently showing{" "}
                <a href="https://www.cdc.gov/coronavirus/2019-ncov/symptoms-testing/symptoms.html">
                  symptoms
                </a>{" "}
                in the last 14 days.
              </Trans>
            </p>
          </li>
        </ul>
        <p className="contentDesc">
          <Trans i18nKey="generalProtocol9">
            We require that all volunteers wear a{" "}
            <a href="https://www.cdc.gov/coronavirus/2019-ncov/prevent-getting-sick/diy-cloth-face-coverings.html">
              face mask or covering
            </a>{" "}
            while performing your deliveries or interacting with recipients and
            community members. Please wear a mask or covering even if you have
            been vaccinated, and follow all state and local recommendations or
            requirements.
          </Trans>
        </p>
        <p className="contentDesc">
          <Trans i18nKey="generalProtocol10">
            We also ask that you follow these general practices just before and
            during a delivery:
          </Trans>
        </p>
        <ul>
          <li>
            <p className="contentDesc">
              <Trans i18nKey="generalProtocol11">
                Wash hands with soap for 20-30 seconds (or if not available, use
                hand sanitizer) frequently, including just before the task and
                just after being in a public place.
              </Trans>
            </p>
          </li>
          <li>
            <p className="contentDesc">
              <Trans i18nKey="generalProtocol12">
                Wear masks in public settings and when around people who don’t
                live in your household, especially when other social distancing
                measures are difficult to maintain.
              </Trans>
            </p>
          </li>
          <li>
            <p className="contentDesc">
              <Trans i18nKey="generalProtocol13">
                Stay at least 6 feet away from others at the pickup location and
                in lines.
              </Trans>
            </p>
          </li>
        </ul>
        <p className="contentDesc">
          <Trans i18nKey="generalProtocol14">
            If at any time soon after your volunteer task, you start to{" "}
            <a href="https://www.cdc.gov/coronavirus/2019-ncov/symptoms-testing/symptoms.html">
              exhibit symptoms
            </a>{" "}
            or find out you have previously been in contact with someone who had
            COVID-19, please inform us immediately at{" "}
            <a href="mailto:safety@helpinghands.community">
              safety@helpinghands.community
            </a>
            .
          </Trans>
        </p>
        <p className="contentDesc">
          All volunteers must be 18 years or older. Account sharing is strictly
          prohibited; all volunteers are expected to create their own accounts.
          Anyone accompanying a volunteer must comply with the same above
          requirements and guidelines.
        </p>

        <h1>
          <Trans i18nKey="pickUpAndTransitProtocol">
            Pick-up & Transit Protocol
          </Trans>
        </h1>
        <p className="contentDesc">
          <Trans i18nKey="pickUpProtocol1">
            Volunteers should practice the following behaviors in the process of
            completing your deliveries:
          </Trans>
        </p>
        <ul>
          <li>
            <p className="contentDesc">
              <Trans i18nKey="pickUpProtocol2">
                If available, use hand sanitizer after leaving a location.
              </Trans>
            </p>
          </li>
          <li>
            <p className="contentDesc">
              <Trans i18nKey="pickUpProtocol3">
                Clean and disinfect frequently touched surfaces in your car
                (e.g., the steering wheel, door handles, and surfaces on which
                groceries, food, or mail will be transported).
              </Trans>
            </p>
          </li>
          <li>
            <p className="contentDesc">
              <Trans i18nKey="pickUpProtocol4">
                Avoid tampering with, or opening, any packages.
              </Trans>
            </p>
          </li>
        </ul>

        <h1>{t("delivery")}</h1>
        <p className="contentDesc">
          <Trans i18nKey="deliveryProtocol1">
            Volunteers should have contactless deliveries with the recipient:
          </Trans>
        </p>
        <ul>
          <li>
            <p className="contentDesc">
              <Trans i18nKey="deliveryProtocol2">
                Call the recipient to let them know that you have arrived and
                that you will be leaving their items at the front door.
              </Trans>
            </p>
          </li>
          <li>
            <p className="contentDesc">
              <Trans i18nKey="deliveryProtocol3">
                You should never enter the home of a recipient, even if
                requested.
              </Trans>
            </p>
          </li>
        </ul>
        <p className="contentDesc">
          <Trans i18nKey="deliveryProtocol4">
            Thank you for being a respectful member of the Helping Hands
            community!
          </Trans>
        </p>
        <br />
        <br />
        <p align="center">
          <iframe
            width={isMobile ? "320" : "1120"}
            height={isMobile ? "180" : "630"}
            src="https://www.youtube-nocookie.com/embed/gaQNRaejOlQ"
            title="Helping Hands Volunteer Safety video"
            frameBorder="0"
            allow="accelerometer; autoplay; encrypted-media; gyroscope; picture-in-picture"
            allowFullScreen></iframe>
        </p>
      </Container>
    </div>
  );
}
