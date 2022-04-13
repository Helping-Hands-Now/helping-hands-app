import React from "react";
import { shallow } from "enzyme";
import About from "./index";

// Prevents a jest-specific warning about i18next not being initialized
// Context: https://github.com/i18next/react-i18next/issues/876#issuecomment-571102963
jest.mock("react-i18next", () => ({
  useTranslation: () => ({ t: (key) => key }),
}));

it("renders without crashing", () => {
  const div = shallow(<About />);
  expect(div.find(".contentContainer")).toHaveLength(1);
});
