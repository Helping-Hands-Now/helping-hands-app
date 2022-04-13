import React from "react";

export default function OrgAddress(props) {
  let profile = props.profile;
  if (!profile) {
    return "Address not known";
  }
  let apartment = profile.apartment ? `# ${profile.apartment}` : "";

  return (
    <>
      {profile.street}, {apartment}
      <br />
      {profile.city}, {profile.state}, {profile.zipCode}
    </>
  );
}
