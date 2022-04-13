import React from "react";
import { Link } from "react-router-dom";
import "semantic-ui-css/semantic.min.css";
import { Container } from "semantic-ui-react";

import { Trans, useTranslation } from "react-i18next";

export default function FAQ(props) {
  const { t } = useTranslation();

  return (
    <div className="contentContainer">
      <Container>
        <h1 className="headPage">{t("frequentlyAsked")}</h1>

        <h2 className="headSection">{t("faqSection1Head")}</h2>

        <p className="contentFAQ">{t("faq1Question")}</p>
        <p className="contentDesc">{t("faq1Answer1")}</p>
        <p className="contentDesc">{t("faq1Answer2")}</p>

        <p className="contentFAQ">{t("faq2Question")}</p>
        <p className="contentDesc">{t("faq2Answer")}</p>

        <p className="contentFAQ">{t("faq3Question")}</p>
        <p className="contentDesc">{t("faq3Answer")}</p>

        <p className="contentFAQ">{t("faq4Question")}</p>
        <p className="contentDesc">{t("faq4Answer1")}</p>
        <p className="contentDesc">{t("faq4Answer2")}</p>
        <p className="contentDesc">{t("faq4Answer3")}</p>
        <p className="contentDesc">{t("faq4Answer4")}</p>

        <p className="contentFAQ">{t("faq5Question")}</p>
        <p className="contentDesc">{t("faq5Answer1")}</p>
        <p className="contentDesc">{t("faq5Answer2")}</p>
        <p className="contentDesc">
          <Trans i18nKey="faq5Answer3">
            If you feel strongly to give financially to enable more of these
            connections, you can <Link to="/donate">make a donation</Link> to
            support Helping Hands.
          </Trans>
        </p>

        <p className="contentFAQ">{t("faq6Question")}</p>
        <p className="contentDesc">{t("faq6Answer")}</p>

        <h2 className="headSection">{t("faqSection2Head")}</h2>

        <p className="contentFAQ">{t("faq7Question")}</p>
        <p className="contentDesc">
          <Trans i18nKey="faq7Answer">
            Anyone who has followed the Trust and Safety requirements in{" "}
            <Link to="/community">the community guidelines</Link> can sign up to
            volunteer.
          </Trans>
        </p>

        <p className="contentFAQ">{t("faq8Question")}</p>
        <p className="contentDesc">
          <Trans i18nKey="faq8Answer">
            Unfortunately not. At this time Helping Hands volunteers must be 18
            years or older. If you would like to volunteer with someone 18+ in
            your immediate household, you may go with them as long as you both
            meet <Link to="/community">the community guidelines</Link>.
          </Trans>
        </p>

        <p className="contentFAQ">{t("faq9Question")}</p>
        <p className="contentDesc">
          <Trans i18nKey="faq9Answer">
            If you plan to bring someone from your immediate household with you
            to volunteer, please make sure that they also meet{" "}
            <Link to="/community">the community guidelines</Link>. We understand
            that you may need or want to bring a loved one with you and
            appreciate your extra care in trust and safety so that we may keep
            our communities healthy.
          </Trans>
        </p>

        <p className="contentFAQ">{t("faq10Question")}</p>
        <p className="contentDesc">{t("faq10Answer1")}</p>
        <ul>
          <li>
            <p className="contentDesc">
              <Trans i18nKey="faq10Answer2">
                Spread the word on social media -{" "}
                <a href="https://hrefshare.com/ec859">Facebook</a>,{" "}
                <a href="https://hrefshare.com/0362a">Twitter</a>,{" "}
                <a href="https://www.instagram.com/p/B-ScmV1Fwpi/?utm_source=ig_web_copy_link">
                  Instagram
                </a>
                , <a href="https://hrefshare.com/ca77d">LinkedIn</a>
              </Trans>
            </p>
          </li>
          <li>
            <p className="contentDesc">{t("faq10Answer3")}</p>
            <p className="contentDesc">
              <Trans i18nKey="faq10Answer4">
                <em>
                  I wanted to tell you about{" "}
                  <a href="https://helpinghands.community/?utm_source=fieldemail&utm_medium=email&utm_campaign=spreadthewordcta">
                    Helping Hands
                  </a>
                  , a nonprofit organization dedicated to helping the most
                  at-risk people in our community stay safe at home, while
                  getting the supplies they need. It works by connecting local
                  volunteers who can run critical errands, such as grocery
                  shopping, with the most vulnerable members of our community.
                  If you or someone you know needs help, fill out a{" "}
                  <a href="https://helpinghands.community/help">request</a>. If
                  you are healthy and able to volunteer, please{" "}
                  <a href="https://helpinghands.community/give">
                    sign up to help
                  </a>
                  . Together, we can help flatten the curve of COVID-19 by
                  protecting our community’s most vulnerable.
                </em>
              </Trans>
            </p>
          </li>
        </ul>
        <p className="contentDesc">{t("faq10Answer5")}</p>

        <p className="contentFAQ">{t("faq11Question")}</p>
        <p className="contentDesc">
          <Trans i18nKey="faq11Answer">
            Yes, you can see the Helping Hands Privacy Policy{" "}
            <Link to="/privacy">here</Link>.
          </Trans>
        </p>

        <p className="contentFAQ">{t("faq12Question")}</p>
        <p className="contentDesc">{t("faq12Answer1")}</p>
        <p className="contentDesc">{t("faq12Answer2")}</p>

        <h2 className="headSection">{t("faqSection3Head")}</h2>

        <p className="contentFAQ">{t("faq13Question")}</p>
        <p className="contentDesc">
          <Trans i18nKey="faq13Answer">
            <em>Now Helping Hands</em> is a nonprofit public benefit corporation
            registered with the state of California.{" "}
          </Trans>
        </p>

        <p className="contentFAQ">{t("faq14Question")}</p>
        <p className="contentDesc">
          <Trans i18nKey="faq14Answer">
            Your donation will directly support members of your community who
            are most at-risk to COVID-19. Seniors. People with weakened immune
            systems. Folks with preexisting medical conditions. Individuals who
            need to stay home to remain safe. You can donate{" "}
            <Link to="/donate">here</Link>.
          </Trans>
        </p>

        <p className="contentFAQ">{t("faq15Question")}</p>
        <p className="contentDesc">{t("faq15Answer")}</p>

        <p className="contentFAQ">{t("faq16Question")}</p>
        <em>
          <p className="contentDesc">{t("faq16Answer")}</p>
        </em>

        <p className="contentFAQ">{t("faq17Question")}</p>
        <p className="contentDesc">{t("faq17Answer")}</p>

        <p className="contentFAQ">{t("faq18Question")}</p>
        <p className="contentDesc">{t("faq18Answer")}</p>
      </Container>
    </div>
  );
}
