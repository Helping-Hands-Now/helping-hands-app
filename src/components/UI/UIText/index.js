import styled from "styled-components";
import { inputError, inputHover } from "../styles.js";

const UIText = styled.h1`
  font-size: 15px;
  font-family: AvenirRegular;
  margin-bottom: 5px;
  color: ${(props) => (props.error ? inputError : inputHover)};
`;

export default UIText;
