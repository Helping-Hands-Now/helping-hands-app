import React from "react";
import { Container } from "semantic-ui-react";

export default function OrgTripInfo(props) {
  let profile = props.profile;
  return (
    <>
      {`${profile.totalTrips} deliveries supplied`}
      {profile.tripsInfo.map((tripInfo, i) => (
        <Container fluid key={i}>
          <div>status: {tripInfo.status}</div>
          <div>count: {tripInfo.count}</div>
          <div>
            most recent time:
            {new Date(
              tripInfo.mostRecentTime._seconds * 1000
            ).toLocaleDateString()}
          </div>
        </Container>
      ))}
    </>
  );
}
