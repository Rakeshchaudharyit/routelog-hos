import { Route } from "lucide-react";
import { useWorkspace } from "../../context/WorkspaceContext";
export function Brand({ logo, name }: { logo?: string; name?: string }) {
  const { branding } = useWorkspace();
  const image = logo ?? branding.logo;
  const title = name ?? branding.appName;
  return (
    <>
      <span className="brand-mark">
        {image ? (
          <img className="custom-logo" src={image} alt="Workspace logo" />
        ) : (
          <Route size={25} />
        )}
      </span>
      <span className="brand-name">
        {title === "RouteLog HOS" ? (
          <>
            RouteLog <b>HOS</b>
          </>
        ) : (
          title
        )}
      </span>
    </>
  );
}
