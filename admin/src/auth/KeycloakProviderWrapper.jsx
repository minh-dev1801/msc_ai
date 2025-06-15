import { useEffect, useState, useRef } from "react";
import keycloak from "./keyCloak";
import { Spin } from "antd";
import { KeycloakContext } from "./KeycloakContext";
import PropTypes from "prop-types";

export const KeycloakProviderWrapper = ({ children }) => {
  const [initialized, setInitialized] = useState(false);
  const [authenticated, setAuthenticated] = useState(false);
  const hasInitialized = useRef(false);

  useEffect(() => {
    if (!hasInitialized.current) {
      hasInitialized.current = true;

      keycloak
        .init({
          onLoad: "check-sso",
          silentCheckSsoRedirectUri:
            window.location.origin + "/silent-check-sso.html",
          checkLoginIframe: false,
          enableLogging: true,
        })
        .then((auth) => {
          setAuthenticated(auth);
          setInitialized(true);

          if (auth) {
            setInterval(() => {
              keycloak.updateToken(30).catch((error) => {
                console.error("Lỗi khi làm mới token:", error);
              });
            }, 10000);
          }
        })
        .catch((error) => {
          console.error("Keycloak init error:", error);
          setInitialized(true);
        });
    }
  }, []);

  if (!initialized) {
    return <Spin fullscreen tip="Đang xác thực..." />;
  }

  return (
    <KeycloakContext.Provider value={{ keycloak, authenticated }}>
      {children}
    </KeycloakContext.Provider>
  );
};

KeycloakProviderWrapper.propTypes = {
  children: PropTypes.node,
};
