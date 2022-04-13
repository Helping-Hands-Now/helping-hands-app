import React from "react";
import mediaQuery from "css-mediaquery";
import { mount, shallow } from "enzyme";
import { act } from "react-dom/test-utils";

import FirebaseWrapper from "./index";

import { GlobalStateProvider } from "../../hooks/useGlobalState";

// We need to wrap GlobalStateProvider manually for hooks to work
const TestComponent = () => (
  <GlobalStateProvider>
    <FirebaseWrapper />
  </GlobalStateProvider>
);

// Fixes a current bug with jest, enzyme, and the useEffect hook
// See thread for more details: https://github.com/enzymejs/enzyme/issues/2073
// This specific fix adapted from: https://github.com/enzymejs/enzyme/issues/2073#issuecomment-565736674
const waitForComponentToPaint = async (wrapper) => {
  await act(async () => {
    await new Promise((resolve) => setTimeout(resolve, 0));
    wrapper.update();
  });
};

// TODO: Write a mobile nav test!
// Allows us to test useMediaQuery
// Source: https://material-ui.com/components/use-media-query/#testing
function createMatchMedia(width) {
  return (query) => ({
    matches: mediaQuery.match(query, { width }),
    addListener: () => {},
    removeListener: () => {},
  });
}

it("Renders the Firebase Wrapper", () => {
  const wrapper = shallow(<TestComponent />);

  expect(wrapper).toBeTruthy();
  expect(wrapper.find(FirebaseWrapper)).toHaveLength(1);
});

it("Renders a <Nav> component", () => {
  const wrapper = mount(<TestComponent />);

  waitForComponentToPaint(wrapper);

  expect(wrapper.find("Nav")).toHaveLength(1);
});

it("Renders a desktop navigation bar on non-mobile devices", () => {
  const wrapper = mount(<TestComponent />);

  waitForComponentToPaint(wrapper);

  const nav = wrapper.find("Nav");

  expect(nav.find("Menu.navMenu")).toHaveLength(1);
  expect(nav.find(".mobileMenu")).toHaveLength(0);
});
