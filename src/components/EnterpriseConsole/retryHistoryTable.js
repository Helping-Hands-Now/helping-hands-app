import React from "react";
import { Table, Label } from "semantic-ui-react";
import Moment from "moment";

const RetryHistoryTable = (props) => {
  const data = props.data;

  const PENDING = "pending_fulfillment";
  const OPEN = "open";
  const CLOSED = "closed";

  var failureReason;

  switch (data.outcome) {
    case "error_creating":
      failureReason = "Error creating Uber Trip";
      break;

    case "timed_out":
      failureReason = "Dispatch Timeout";
      break;

    case "probably_timed_out":
      failureReason = "Probably Dispatch Timeout";
      break;

    case "COURIER_CANCEL":
      failureReason = "Driver Cancelled";
      break;
    default:
      break;
  }

  return (
    <Table celled>
      <Table.Header>
        <Table.Row>
          <Table.HeaderCell>Status</Table.HeaderCell>
          <Table.HeaderCell>Uber Status</Table.HeaderCell>
          <Table.HeaderCell>Time Retried</Table.HeaderCell>
          {data.timeClosed && data.timeClosed !== null && (
            <Table.HeaderCell>Time Closed</Table.HeaderCell>
          )}
          {failureReason && <Table.HeaderCell>Failure Error</Table.HeaderCell>}
        </Table.Row>
      </Table.Header>

      <Table.Body>
        <Table.Row>
          <Table.Cell>
            <Label
              color={
                (data.status === OPEN && "red") ||
                (data.status === PENDING && "yellow") ||
                (data.status === CLOSED && "green")
              }>
              {data.status}
            </Label>
          </Table.Cell>
          <Table.Cell>
            <Label>{data.uberStatus}</Label>
          </Table.Cell>
          <Table.Cell>
            <Label as="a">
              <h5>
                <Moment format="LLLL" date={data.timeCreated._seconds * 1000} />
              </h5>
            </Label>
          </Table.Cell>
          {data.timeClosed && data.timeClosed !== null && (
            <Table.Cell>
              <Label as="a">
                <h5>
                  <Moment
                    format="LLLL"
                    date={data.timeClosed._seconds * 1000}
                  />
                </h5>
              </Label>
            </Table.Cell>
          )}
          {failureReason && (
            <Table.Cell>
              <Label>{failureReason}</Label>
            </Table.Cell>
          )}
        </Table.Row>
      </Table.Body>
    </Table>
  );
};

export default RetryHistoryTable;
