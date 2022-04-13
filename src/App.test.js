import React from "react";
import { shallow } from "enzyme";
import App from "./App";

it("renders without crashing", () => {
  const div = shallow(<App />);
  expect(div).toHaveLength(1);
});
