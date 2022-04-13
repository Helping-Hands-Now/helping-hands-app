import React from "react";
import styled from "styled-components";
import { Table } from "semantic-ui-react";

const Styles = styled.div``;

export default function AdminDashboard({ data }) {
  return (
    <Styles>
      <Table>
        <Table.Header>
          <Table.Row>
            <Table.HeaderCell>Data</Table.HeaderCell>
            <Table.HeaderCell>Count</Table.HeaderCell>
          </Table.Row>
        </Table.Header>
        {data.map((datum, i) => (
          <Table.Body key={i}>
            <Table.Row>
              <Table.Cell>{datum.label}</Table.Cell>
              <Table.Cell>{datum.count}</Table.Cell>
            </Table.Row>
          </Table.Body>
        ))}
      </Table>
    </Styles>
  );
}
