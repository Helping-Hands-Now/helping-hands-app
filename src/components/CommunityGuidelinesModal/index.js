import React from "react";
import "semantic-ui-css/semantic.min.css";
import { Modal } from "semantic-ui-react";

import { useTranslation } from "react-i18next";
import CommunityProtocols from "../CommunityProtocols";

// TODO: We should dedupe these modal components and create a generic modal that accepts a title and
// either a block of JSX or another React component as props
export default function CommunityGuidelinesModal(props) {
  const { t } = useTranslation();

  return (
    <Modal
      className="modal"
      closeIcon
      trigger={<a style={{ cursor: "pointer" }}>{t("communityGuidelines")}</a>}>
      <Modal.Content>
        <CommunityProtocols />
      </Modal.Content>
    </Modal>
  );
}
