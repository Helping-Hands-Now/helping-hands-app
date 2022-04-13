/*eslint no-unused-vars: ["error", { "argsIgnorePattern": "^_", "varsIgnorePattern": "^_"  }]*/
import React, { useState, useEffect } from "react";
import { useTranslation } from "react-i18next";
import { queryUserOrganizations } from "../../firebase";
import UIDropdown from "../UI/UIDropdown";
import { Loader, Label, Grid, Button, Icon, Form } from "semantic-ui-react";

function OrgDropDownRow({ rightElement, ...rest }) {
  return (
    <Form>
      <Grid>
        <Grid.Column width={!!rightElement ? 14 : 16}>
          <UIDropdown {...rest} />
        </Grid.Column>
        {!!rightElement && (
          <Grid.Column width={2} verticalAlign="middle">
            {rightElement}
          </Grid.Column>
        )}
      </Grid>
    </Form>
  );
}

export default function OrgDropdown({ setCurrentOrgId, currentOrgId }) {
  const { t } = useTranslation();
  const [organizations, setOrganizations] = useState([]);
  const [orgsLoaded, setOrgsLoaded] = useState(false);
  const [orgsLoadError, setOrgsLoadError] = useState(false);
  const [lastRefreshRequestTime, setLastRefreshRequestTime] = useState(
    new Date()
  );

  useEffect(() => {
    queryUserOrganizations().then(
      (r) => {
        let orgs = r.data;
        setOrganizations(orgs);
        setOrgsLoaded(true);
        setOrgsLoadError(false);
        if (currentOrgId && !orgs.map((org) => org.id).includes(currentOrgId)) {
          setCurrentOrgId(null);
        }
        if (orgs.length === 1) {
          setCurrentOrgId(orgs[0].id);
        }
      },
      (_error) => {
        setOrgsLoadError(true);
      }
    );
  }, [lastRefreshRequestTime]);

  let options = organizations.map((org) => {
    return {
      key: org.id,
      value: org.id,
      text: org.organizationName,
    };
  });

  if (orgsLoadError) {
    let refreshButton = (
      <Button icon onClick={() => setLastRefreshRequestTime(new Date())}>
        <Icon name="refresh" />
      </Button>
    );
    return (
      <OrgDropDownRow
        label={t("selectOrg")}
        hook={(e, d) => setCurrentOrgId(d.value)}
        error
        disabled
        placeholder={t("Org loading failed.")}
        rightElement={refreshButton}
      />
    );
  } else if (!orgsLoaded) {
    return (
      <OrgDropDownRow
        label={t("selectOrg")}
        disabled
        placeholder={t("Loading...")}
        rightElement={<Loader active inline size="small" />}
      />
    );
  } else if (!organizations.length) {
    return (
      <OrgDropDownRow
        error
        placeholder={t("You don't have access to any organizations.")}
        disabled
        rightElement={<Icon name="warning circle" color="red" />}
      />
    );
  } else if (!currentOrgId) {
    return (
      <OrgDropDownRow
        label={t("selectOrg")}
        hook={(e, d) => setCurrentOrgId(d.value)}
        selection
        options={options}
        value={currentOrgId}
        placeholder={t("Please select an organization.")}
        rightElement={
          <Label basic color="red" pointing="left">
            {t("Please select")}
          </Label>
        }
      />
    );
  } else {
    return (
      <OrgDropDownRow
        label={t("selectOrg")}
        hook={(e, d) => setCurrentOrgId(d.value)}
        selection
        options={options}
        defaultValue={currentOrgId}
        value={currentOrgId}
        placeholder={t("Please select an organization.")}
      />
    );
  }
}
