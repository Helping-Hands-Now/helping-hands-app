import React, { useState, useEffect } from "react";
import { Container, Grid } from "semantic-ui-react";
import UIButton from "../UI/UIButton";
// import SendToDispatch from "./sendToDispatch";

import ImportVolunteers from "../OrgVolunteers/volunteerImporter";

function Import({ nextHandler, setSelectedVolunteers }) {
  const setVolunteerData = (volunteerData) => {
    let volunteers = [];
    volunteerData.existing.forEach((existing) => {
      // make sure we have ids as top level for SendToDispatch
      existing.id = existing.userProfile.id;
      volunteers.push(existing);
    });
    volunteers = volunteers.concat(volunteerData.new);
    setSelectedVolunteers(volunteers);
  };

  return (
    <ImportVolunteers
      nextHandler={nextHandler}
      setVolunteerData={setVolunteerData}
    />
  );
}

export default function AdminVolunteers(props) {
  const [importDisabled, setImportDisabled] = useState(true);
  const [importing, setImporting] = useState(true);
  const [selectedVolunteers, setSelectedVolunteers] = useState([]);
  const [completedPage, setCompletedPage] = useState(false);
  const [volunteersPage, setVolunteersPage] = useState(true);

  const nextPage = () => {
    if (volunteersPage) {
      setVolunteersPage(false);
      setCompletedPage(true);
    }
  };

  return (
    <Container>
      {volunteersPage && !importing && (
        <Container textAlign="center">
          <UIButton
            secondary
            onClick={() => setImporting(true)}
            text={"Next"}
            disabled={importDisabled}
          />
        </Container>
      )}
      {volunteersPage && importing && (
        <>
          <Import
            setImporting={setImporting}
            nextHandler={nextPage}
            setSelectedVolunteers={setSelectedVolunteers}
          />
        </>
      )}
      {completedPage && <p> Yay, volunteers successfully added! </p>}
    </Container>
  );
}
