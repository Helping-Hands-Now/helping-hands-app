import React from "react";
import { Grid, Container } from "semantic-ui-react";
import "semantic-ui-css/semantic.min.css";
import "./styles.css";
import { useTranslation, Trans } from "react-i18next";
import { useHistory } from "react-router-dom";
import useGlobalState from "../../hooks/useGlobalState";
import { ReactSVG } from "react-svg";
import { useMediaQuery } from "react-responsive";

import UIButton from "../UI/UIButton";

import { pressStories } from "../../data/pressStories";
import { testimonials } from "../../data/testimonials";
import needHelp from "../../svgs/hhc-products-partner-03 4.svg";
import helpCart from "../../svgs/hhc-products-volunteer-03 4.svg";
import partnerOrganizations from "../../svgs/partner_organizations.svg";
import distributionNetwork from "../../svgs/distribution_network.svg";
import foodDelivered from "../../svgs/food_delivered.svg";
import ourImpact from "../../images/hhc-impact-2020.png";

export default function Home(props) {
  const { t } = useTranslation();

  const history = useHistory();
  const globalState = useGlobalState();
  const isMobile = useMediaQuery({ query: "(max-width: 767px) " });
  const isMobileImages = useMediaQuery({ query: "(max-width: 600px) " });

  const handleButton = (canHelp, partner) => {
    if (partner) {
      history.push("/partner-with-us");
    } else if (canHelp) {
      history.push("/volunteer");
    }
  };

  return (
    <Container className="homePageContainer">
      <h1 className="frontPageHeader">
        Deliver food to your community whenever and{" "}
        <span class="nowrap">wherever</span> they need it
      </h1>
      <div className="mainCallToAction">
        <Grid columns={2} stackable>
          <Grid.Row>
            <Grid.Column className="callToActionColumn">
              <ReactSVG src={needHelp} />
              <div class="CTAsubHeaderBox">
                <br />
                <p className="frontPageTextChoose">{t("homeOver60")}</p>
              </div>
              <br />
              <UIButton
                onClick={() => handleButton(false, true)}
                text={t("partnerWithUs")}
                primary
              />
            </Grid.Column>
            {isMobile && <div class="CTAspacer"></div>}
            <Grid.Column className="callToActionColumn">
              <ReactSVG src={helpCart} />
              <div class="CTAsubHeaderBox">
                <br />
                <p className="frontPageTextChoose">{t("homeHealthy")}</p>
              </div>
              <br />
              <UIButton
                onClick={() => handleButton(true, false)}
                text={t("tabCanHelp")}
                primaryPurple
                className="secondaryColor"
              />
            </Grid.Column>
          </Grid.Row>
        </Grid>
      </div>
      <hr className="horizontalRule" />
      <div className="contentSection">
        <h1 className="frontPageSectionHeader">{t("ourMission")}</h1>
        <br />
        <p className="frontPageText subText">
          HHC aims to provide universal access to food through better technology
          by empowering community organizations to deliver food to people
          efficiently, affordably, and reliably.
        </p>
      </div>
      <hr className="horizontalRule" />
      <div className="contentSection">
        <h1 className="frontPageSectionHeader">{t("howWeHelp")}</h1>
        <br />
        <p className="frontPageText subText">
          We partner with food banks to provide their constituents home
          delivery. Our technology platform connects our partners that serve
          residents in need with delivery partners and local volunteers to
          deliver food and supplies to their homes.
        </p>
        <br />
        <br />
        <Grid columns={3} stackable>
          <Grid.Row>
            <Grid.Column className="callToActionColumn">
              <ReactSVG src={foodDelivered} />
              <div class="HowWeWorkStepContainer">
                <br />
                <p className="HowWeWorkStep">PARTNER ORGANIZATIONS</p>
              </div>
              <p className="subText">
                Food banks, healthcare providers and other partners upload
                recipient details to the HHC platform.
              </p>
            </Grid.Column>
            {isMobile && <div class="CTAspacer"></div>}
            <Grid.Column className="callToActionColumn">
              <ReactSVG src={distributionNetwork} />
              <div class="HowWeWorkStepContainer">
                <br />
                <p className="HowWeWorkStep">OPTIMIZED DISTRIBUTION</p>
              </div>
              <p className="subText">
                HHC optimizes across distribution network of logistics providers
                and community volunteers to facilitate last mile fulfillment.
              </p>
            </Grid.Column>
            <Grid.Column className="callToActionColumn">
              <ReactSVG src={partnerOrganizations} />
              <div class="HowWeWorkStepContainer">
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
      <hr className="horizontalRule" />
      <div className="contentSection">
        <h1 className="frontPageSectionHeader">{t("ourImpact")}</h1>
        <br />
        <p className="frontPageText subText">
          We’re proud of what this group of committed, volunteer professionals
          has accomplished since our inception in March 2020.
        </p>
        <br />
        <div class="recapContainer">
          <img className="impactImage" src={ourImpact} />
        </div>
      </div>
      <hr className="horizontalRule" />
      <div className="contentSection">
        <h1 className="frontPageSectionHeader">{t("partnerTestimonials")}</h1>
        <br />
        <Grid columns={testimonials.length} stackable>
          <Grid.Row>
            {testimonials.map((testimonial, i) => (
              <Grid.Column>
                <div key={i} className="testimonialCard">
                  <br />
                  <img
                    className="testimonialImages"
                    src={testimonial.imagePath}
                    alt={testimonial.imageAltText}
                  />
                  <br />
                  <br />
                  <div class="quoteBox">
                    <p class="testimonialQuote">{testimonial.quote}</p>
                    <br />
                    <p class="testimonialName">{testimonial.name}</p>
                    <p class="testimonialPosition">{testimonial.title}</p>
                    <p class="testimonialCompany">{testimonial.company}</p>
                  </div>
                </div>
              </Grid.Column>
            ))}
          </Grid.Row>
        </Grid>
      </div>
      <hr className="horizontalRule" />
      <div className="inThePressSection">
        <h1 className="frontPageSectionHeader pressSectionHeader">
          <Trans i18Key="inThePress">In the press</Trans>
        </h1>
        <div className="pressStories">
          {pressStories.map((story, i) => (
            <div key={i} className="pressStory">
              <img
                className="pressStoryImage"
                src={story.imagePath}
                alt={story.imageAltText}
              />
              <a
                className="pressStoryHeadline"
                href={story.hyperlink}
                target="_blank"
                rel="noopener noreferrer">
                {story.headline}
              </a>
            </div>
          ))}
        </div>
      </div>
    </Container>
  );
}
