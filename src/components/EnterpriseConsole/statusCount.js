import React, { useState } from "react";
import { Grid, Label, Container, Button } from "semantic-ui-react";

export const UNIFIED_STATUS = {
  UNASSIGNED: "Unassigned",
  ASSIGNED: "Assigned",
  OUT_FOR_DELIVERY: "Out for Delivery",
  COMPLETED: "Completed",
  INCOMPLETE: "Incomplete",
};

const StatusCount = (props) => {
  const count = props.countObject;
  const [assignedActive, setAssignedActive] = useState(false);
  const [deliveryActive, setDeliveryActive] = useState(false);
  const [completedActive, setCompletedActive] = useState(false);
  const [incompleteActive, setIncompleteActive] = useState(false);
  const [unassignedActive, setUnassignedActive] = useState(false);
  const statusButtonStyle = {
    margin: "auto",
    padding: "auto",
    width: "100%",
    height: "100%",
    borderStyle: "solid",
    borderWidth: ".5px",
    backgroundColor: "white",
  };
  const statusStyle = {
    margin: "auto",
    padding: "auto",
    width: "100%",
    height: "100%",
    backgroundColor: "white",
  };
  return (
    <Container>
      <Grid stackable doubling centered>
        <Grid.Column verticalAlign="middle" width={3}>
          <Button
            style={statusButtonStyle}
            toggle
            active={unassignedActive}
            onClick={(e) => {
              setUnassignedActive(!unassignedActive);
              props.updateFilteredButtonStatuses(UNIFIED_STATUS.UNASSIGNED);
            }}>
            <p>
              <strong>{count.pickupsScheduled}</strong>
              <br />
              Unassigned
            </p>
          </Button>
        </Grid.Column>
        <Grid.Column verticalAlign="middle" width={3}>
          {/*[Assigned, Out For Delivery, Completed, Incomplete]*/}
          <Button
            style={statusButtonStyle}
            toggle
            active={assignedActive}
            onClick={(e) => {
              setAssignedActive(!assignedActive);
              props.updateFilteredButtonStatuses(UNIFIED_STATUS.ASSIGNED);
            }}>
            <p>
              <strong>{count.enRouteToPickup}</strong>
              <br />
              Assigned
            </p>
          </Button>
        </Grid.Column>
        <Grid.Column verticalAlign="middle" width={3}>
          <Button
            style={statusButtonStyle}
            toggle
            active={deliveryActive}
            onClick={(e) => {
              setDeliveryActive(!deliveryActive);
              props.updateFilteredButtonStatuses(
                UNIFIED_STATUS.OUT_FOR_DELIVERY
              );
            }}>
            <p>
              <strong>{count.outForDelivery}</strong>
              <br />
              Out for Delivery
            </p>
          </Button>
        </Grid.Column>
        <Grid.Column verticalAlign="middle" width={3}>
          <Button
            style={statusButtonStyle}
            toggle
            active={completedActive}
            onClick={(e) => {
              setCompletedActive(!completedActive);
              props.updateFilteredButtonStatuses(UNIFIED_STATUS.COMPLETED);
            }}>
            <p>
              <strong>{count.completed}</strong>
              <br />
              Completed
            </p>
          </Button>
        </Grid.Column>
        <Grid.Column verticalAlign="middle" width={3}>
          <Button
            style={statusButtonStyle}
            toggle
            active={incompleteActive}
            onClick={(e) => {
              setIncompleteActive(!incompleteActive);
              props.updateFilteredButtonStatuses(UNIFIED_STATUS.INCOMPLETE);
            }}>
            <p>
              <strong>{count.failed}</strong>
              <br />
              Incomplete
            </p>
          </Button>
        </Grid.Column>
        <Grid.Column verticalAlign="middle" width={1}>
          <p style={statusStyle}>
            <strong>{count.total}</strong>
            <br />
            Total
          </p>
        </Grid.Column>
      </Grid>
    </Container>
  );
};

export default StatusCount;
