import React from "react";
import "semantic-ui-css/semantic.min.css";
import styled from "styled-components";
import "./style.css";
import { useTranslation } from "react-i18next";
import { ReactSVG } from "react-svg";
import { Card, Grid } from "semantic-ui-react";
import { useMediaQuery } from "react-responsive";

import {
  primaryColorDefault,
  primaryColorHover,
  primaryColorActive,
} from "../UI/styles.js";
import widerCircle from "../../svgs/Wider_Circle_2.svg";
import APlus from "../../svgs/a_plus.svg";
import Uber from "../../svgs/uber.svg";
import Hand from "../../svgs/hand.svg";
import Lyft from "../../svgs/lyft.svg";
import Partner1 from "../../svgs/partner1.svg";
import Partner2 from "../../svgs/partner2.svg";
import Partner3 from "../../svgs/partner3.svg";
import Harvest from "../../svgs/second_harvest.svg";

/*
 * Constants.
 */

const recipient = "partners@helpinghands.community";
const subject = "Partner Submission from HHC Partner Landing Page";
const body =
  "A submission was made on the Partner Landing Page on the HHC website. Please follow up:%0D%0A%0D%0AName: %0D%0A%0D%0ACompany/Organization: %0D%0A%0D%0AEmail address: %0D%0A%0D%0APhone number: %0D%0A%0D%0AHow can we help?:";
const partnerWithUsLink = `mailto:${recipient}?subject=${subject}&body=${body}`;

/*
 * Styles.
 */

const StyledContainer = styled.div`
  max-width: 750px;
  margin-left: auto;
  margin-right: auto;
  padding-left: 50px;
`;

const StyledPageHeader = styled.h1`
  font-family: "SourceSansProBold";
  font-size: 40px;
  line-height: 50px;
  text-align: center;
  color: #42b6e9;
  margin-bottom: 36px;
`;

const StyledSectionHeader = styled.h2`
  font-family: "SourceSansProBold";
  text-align: center;
  font-size: 30px;
  line-height: 38px;
  margin-top: 50px;
  margin-bottom: 20px;
`;

const StyledEmailButtonRow = styled.div`
  margin-top: 30px;
  display: flex;
  justify-content: center;
`;

// Repeat of button code, but is a link so could not use button.
const StyledEmailButton = styled.a`
  display: inline-block;
  padding: 0.78571429em 1.5em;
  text-transform: none;
  text-shadow: none;
  font-weight: 700;
  line-height: 1em;
  font-style: normal;
  text-align: center;
  text-decoration: none;
  user-select: none;
  transition: opacity 0.1s ease, background-color 0.1s ease, color 0.1s ease,
    box-shadow 0.1s ease, background 0.1s ease;
  will-change: "";
  border-radius: 100px !important;
  padding: 16px 24px 13px !important;
  font-weight: bold !important;
  font-size: 18px !important;
  line-height: 24px !important;
  text-align: center !important;
  color: rgb(255, 255, 255) !important;
  font-family: AvenirBold !important;
  background-color: ${primaryColorDefault};
  &:hover {
    background-color: ${primaryColorHover};
  }
  &:active {
    background-color: ${primaryColorActive};
  }
`;

const StyledParagraph = styled.p`
  font-family: "LatoRegular";
  font-size: 18px;
  line-height: 27px;
  color: #434343;
`;

const StyledParagraphBold = styled.p`
  font-family: "LatoRegular";
  font-size: 18px;
  line-height: 27px;
  color: #434343;
  font-weight: bold;
`;

const StyledEmailText = styled.a`
  font-family: "LatoRegular";
  font-size: 18px;
  line-height: 27px;
  color: #0081de;
`;

const StyledProductDescriptionGrid = styled.div`
  margin-top: 50px;
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(300px, 1fr));
  column-gap: 10px;
`;

const StyledProductDescriptionItem = styled.div`
  display: flex;
  flex-direction: column;
  align-items: center;
  padding: 50px 25px;
  background: #f2f5f5;
  margin-bottom: 10px;
`;

const StyledProductDescriptionItemHeader = styled.div`
  color: black;
  font-family: SourceSansProBold;
  font-size: 17px;
  line-height: 27px;
  font-weight: bold;
  margin-bottom: 20px;
`;

const StyledProductDescriptionItemDescription = styled.div`
  color: black;
  font-family: SourceSansProRegular;
  font-size: 17px;
  line-height: 27px;
  text-align: center;
`;

const StyledPartnerImagesRow = styled.div`
  display: grid;
  grid-template-columns: repeat(auto-fit, 166px);
  grid-column-gap: 16px;
  grid-row-gap: 32px;
  padding: 0 32px;
  justify-content: center;
`;

const StyledPartnerImageContainer = styled.div`
  display: flex;
  align-items: center;
  justify-content: center;
  width: 166px;
  height: 110px;
`;

const StyledPartnerImage = styled.img`
  max-width: 100%;
  max-height: 100%;
`;

/*
 * Component.
 */

export default function PartnerWithUs() {
  const { t } = useTranslation();
  const isMobileImages = useMediaQuery({ query: "(max-width: 600px) " });

  return (
    <div>
      <StyledContainer className="contentContainer">
        <StyledPageHeader>{t("partnership")}</StyledPageHeader>
        <StyledParagraph>{t("magnitude")}</StyledParagraph>
        <StyledSectionHeader>{t("food")}</StyledSectionHeader>
        <StyledParagraph>{t("connectWithDelivery")}</StyledParagraph>
        <StyledParagraph>{t("partnerships")}</StyledParagraph>
        <StyledParagraph>
          <a
            href="mailto:partners@helpinghands.community"
            target="_blank"
            rel="noopener noreferrer">
            {t("emailPartners")}
          </a>
        </StyledParagraph>
        <StyledSectionHeader>{t("howItWorks")}</StyledSectionHeader>
        <StyledParagraph>{t("webBased")}</StyledParagraph>
        <br />
        <div>
          <Grid columns={3} stackable className="row-partners">
            <Grid.Row>
              <Grid.Column>
                <ReactSVG src={Partner1} />
                <div className="HowWeWorkStepContainer">
                  <br />
                  <p className="HowWeWorkStep">PARTNER ORGANIZATIONS</p>
                </div>
                <p className="subText">
                  Food banks, healthcare providers and other partners upload
                  recipient details to the HHC platform.
                </p>
              </Grid.Column>
              <Grid.Column>
                <ReactSVG src={Partner2} />
                <div className="HowWeWorkStepContainer">
                  <br />
                  <p className="HowWeWorkStep">OPTIMIZED DISTRIBUTION</p>
                </div>
                <p className="subText">
                  HHC optimizes across distribution network of logistics
                  providers and community volunteers to facilitate last mile
                  fulfillment.
                </p>
              </Grid.Column>
              <Grid.Column>
                <ReactSVG src={Partner3} />
                <div className="HowWeWorkStepContainer">
                  <br />
                  <p className="HowWeWorkStep">FOOD DELIVERED TO RECIPIENTS</p>
                </div>
                <p className="subText">
                  Recipients receive contactless food deliveries at home from
                  volunteers or couriers like Uber and Lyft.
                </p>
              </Grid.Column>
            </Grid.Row>
          </Grid>
        </div>
        <StyledSectionHeader>{t("multiple")}</StyledSectionHeader>
        <br />
        <br />

        <Grid columns={2} stackable>
          <Grid.Row>
            <Grid.Column className="row-partners-column">
              <Card className="card-partner card-deliveries">
                <Card.Content>
                  <Card.Header className="card-header-partner">
                    <div className="box-logos">
                      <StyledPartnerImage className="triptic" src={Uber} />
                      <StyledPartnerImage className="triptic" src={Lyft} />
                    </div>
                  </Card.Header>
                  <Card.Description className="logistic-partner">
                    <h3>Logistic Partners</h3>
                  </Card.Description>
                  <Card.Description>
                    <ul>
                      <li className="li-box">
                        <span className="bold">
                          API Integrations with logistic partners,{" "}
                        </span>
                        <span>
                          enabling HHC partner nonprofits to access state of the
                          art last-mile solutions
                        </span>
                      </li>
                    </ul>
                  </Card.Description>
                  <Card.Description>
                    <ul>
                      <li className="li-box">
                        <span className="bold">
                          Most delivery costs treated as pass-through{" "}
                        </span>
                        <span>to HHC partner organizations</span>
                      </li>
                    </ul>
                  </Card.Description>
                </Card.Content>
              </Card>
            </Grid.Column>

            <Grid.Column className="row-partners-column">
              <Card className="card-partner card-deliveries">
                <Card.Content>
                  <Card.Header className="card-header-partner">
                    <div className="box-logos">
                      <StyledPartnerImage className="triptic" src={Hand} />
                    </div>
                  </Card.Header>
                  <Card.Description className="logistic-partner">
                    <h3>Community Delivery</h3>
                  </Card.Description>
                  <Card.Description>
                    <ul>
                      <li className="li-box">
                        HHC platform coordinates{" "}
                        <b className="bold">
                          delivery via local community volunteers
                        </b>
                      </li>
                    </ul>
                  </Card.Description>
                  <Card.Description>
                    <ul>
                      <li className="li-box">
                        When available,{" "}
                        <span className="bold">
                          HHC partners use 'free' volunteer resource to complete
                          deliveries
                        </span>
                      </li>
                    </ul>
                  </Card.Description>
                </Card.Content>
              </Card>
            </Grid.Column>
          </Grid.Row>
        </Grid>

        <StyledSectionHeader className="scale">
          {t("scale")}
        </StyledSectionHeader>
        <StyledParagraph>{t("devlivery4")}</StyledParagraph>
        <StyledSectionHeader> {t("collaborate")}</StyledSectionHeader>
        <StyledParagraph>{t("nonProfit")}</StyledParagraph>
        <StyledSectionHeader> {t("support2")}</StyledSectionHeader>
        <StyledParagraph>{t("partner")}</StyledParagraph>
        <StyledSectionHeader>{t("partner2")}</StyledSectionHeader>
        <br />
        <br />
        <Grid columns={2} stackable>
          <Grid.Row>
            <Grid.Column className="row-partners-column">
              <Card className="card-partner partners">
                <Card.Content className="partners-content">
                  <Card.Header className="card-header-partner-bottom">
                    <StyledPartnerImage
                      className="card-logo-partner"
                      src={Harvest}
                    />
                  </Card.Header>
                  <Card.Meta className="opening-quote-box">
                    <span className="styled-quote">“</span>
                  </Card.Meta>
                  <Card.Description className="card-partner-description">
                    <p>
                      Our partnership with Helping Hands Community brings food
                      directly to vulnerable populations in Santa Clara and San
                      Mateo counties, while also reducing their risk of
                      exposure.
                    </p>
                  </Card.Description>
                  <Card.Meta className="closing-quote-box">
                    <span className="styled-quote">”</span>
                  </Card.Meta>
                  <Card.Description>
                    <p>
                      <b>Bruno Pillet</b>
                    </p>
                    <span>VP Programs & Services</span>
                    <br />
                    <span>Second Harvest of Silicon Valley</span>
                  </Card.Description>
                </Card.Content>
              </Card>
            </Grid.Column>
            <Grid.Column className="row-partners-column">
              <Card className="card-partner partners">
                <Card.Content className="partners-content">
                  <Card.Header className="card-header-partner-bottom">
                    <StyledPartnerImage
                      className="card-logo-partner"
                      src={widerCircle}
                    />
                  </Card.Header>
                  <Card.Meta className="opening-quote-box">
                    <span className="styled-quote">“</span>
                  </Card.Meta>
                  <Card.Description className="card-partner-description">
                    <p>
                      During this time of immense need, Helping Hands Community
                      has been a mission-critical partner helping us to get
                      supplies into the hands of vulnerable seniors throughout
                      the communities we serve.
                    </p>
                  </Card.Description>
                  <Card.Meta className="closing-quote-box">
                    <span className="styled-quote">”</span>
                  </Card.Meta>
                  <Card.Description>
                    <p>
                      <b>Darin Buxbaum</b>
                    </p>
                    <span>President & COO</span>
                    <br />
                    <span>Wider Circle</span>
                  </Card.Description>
                </Card.Content>
              </Card>
            </Grid.Column>
          </Grid.Row>
        </Grid>

        <StyledParagraph className="contact-us">
          <a
            href="mailto:partners@helpinghands.community"
            target="_blank"
            rel="noopener noreferrer">
            {" "}
            {t("contactUs")}
          </a>{" "}
          to learn more about how you can partner with Helping Hands Community
        </StyledParagraph>
      </StyledContainer>
    </div>
  );
}
