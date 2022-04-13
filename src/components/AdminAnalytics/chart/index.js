import React from "react";
import { Container } from "semantic-ui-react";
import { BarChart, CartesianGrid, XAxis, YAxis, Bar, Tooltip } from "recharts";

export default function AdminChart(props) {
  return (
    <Container>
      {props.barChart && (
        <BarChart width={730} height={250} data={props.data}>
          <CartesianGrid strokeDasharray="3 3" />
          <XAxis dataKey={props.xAxisKey} />
          <YAxis />
          <Tooltip />
          <Bar dataKey={props.yAxisKey} fill="#8884d8" />
        </BarChart>
      )}
    </Container>
  );
}
