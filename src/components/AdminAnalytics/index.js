import React from "react";
import { Container } from "semantic-ui-react";
import { useTranslation } from "react-i18next";

import Chart from "./chart";
import Map from "./map";

export default function AdminAnalytics({ data }) {
  const { t } = useTranslation();

  return (
    <Container>
      <Map />
      <h1>{t("analyticsUsersPerDay")}</h1>
      <Chart barChart xAxisKey={"date"} yAxisKey={"value"} data={data} />
    </Container>
  );
}
