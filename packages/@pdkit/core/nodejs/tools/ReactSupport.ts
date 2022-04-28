import path from "path";
import { Construct } from "constructs";
import { GitIgnore, ManifestEntry, Project, XConstruct } from "../../core";
import { NpmIgnore, PackageDependency, PackageDependencyType } from "../constructs";
import { EslintSupport } from "./eslint/EslintSupport";
import { JestSupport } from "./JestSupport";
import { TypeScriptJsxMode, TypescriptSupport, TypescriptSupportProps } from "./TypescriptSupport";

export interface ReactSupportProps {
  readonly enzyme?: boolean;
  readonly testingLibrary?: boolean;
  readonly rewire?: boolean;
  readonly craco?: boolean;
  readonly reactVersion?: string;
  readonly reactScriptsVersion?: string;
  readonly tsconfig?: TypescriptSupportProps & { enabled: boolean };
}

export class ReactSupport extends XConstruct {
  public static readonly ID = "ReactSupport";

  public static hasSupport(construct: Construct) {
    return !!this.tryOf(construct);
  }

  public static of(construct: Construct) {
    return (construct instanceof Project ? construct : Project.of(construct)).findDeepChild(ReactSupport);
  }

  public static tryOf(construct: Construct) {
    return (construct instanceof Project ? construct : Project.of(construct)).tryFindDeepChild(ReactSupport);
  }

  constructor(scope: XConstruct, props?: ReactSupportProps) {
    super(scope, ReactSupport.ID);

    const typescriptSupport = TypescriptSupport.tryOf(this);
    const eslintSupport = EslintSupport.tryOf(this);
    const project = Project.of(this);

    new PackageDependency(this, "react", {
      version: props?.reactVersion ?? "^18",
    });
    new PackageDependency(this, "react-dom", {
      version: props?.reactVersion ?? "^18",
    });
    new PackageDependency(this, "react-scripts", {
      type: PackageDependencyType.DEV,
      version: props?.reactScriptsVersion ?? "^5",
    });

    if (typescriptSupport) {
      new PackageDependency(this, "@types/react", {
        type: PackageDependencyType.DEV,
        version: props?.reactVersion ?? "^18",
      });
      new PackageDependency(this, "@types/react-dom", {
        type: PackageDependencyType.DEV,
        version: props?.reactVersion ?? "^18",
      });
    }

    if (props?.enzyme) {
      new PackageDependency(this, "@wojtekmaj/enzyme-adapter-react-17", {
        type: PackageDependencyType.DEV,
      });
      new PackageDependency(this, "enzyme", {
        type: PackageDependencyType.DEV,
      });

      if (typescriptSupport) {
        new PackageDependency(this, "@types/enzyme", {
          type: PackageDependencyType.DEV,
        });
      }
    }

    if (props?.testingLibrary) {
      new PackageDependency(this, "@testing-library/jest-dom", {
        type: PackageDependencyType.DEV,
      });
      new PackageDependency(this, "@testing-library/react", {
        type: PackageDependencyType.DEV,
      });
      new PackageDependency(this, "@testing-library/user-event", {
        type: PackageDependencyType.DEV,
      });
    }

    typescriptSupport?.file.addDeepFields({
      include: [path.join(project.sourcePath, "*.tsx"), path.join(project.sourcePath, "**/*.tsx")],
      compilerOptions: {
        lib: ["dom", "dom.iterable", "esnext"],
        module: "commonjs",
        noEmit: true,
        declaration: false,
        target: "ES5",
        jsx: TypeScriptJsxMode.REACT_JSX,
        skipLibCheck: true,
        ...props?.tsconfig?.compilerOptions,
      },
    });
    new GitIgnore(this, ["build/*", "!react-app-env.d.ts", "!setupProxy.js", "!setupTests.js"]);
    new NpmIgnore(this, ["build/*", "!react-app-env.d.ts", "!setupProxy.js", "!setupTests.js"]);

    let reactScriptsCommand = "npx react-scripts";

    if (props?.rewire) {
      new PackageDependency(this, "react-app-rewired", {
        type: PackageDependencyType.DEV,
      });
      new PackageDependency(this, "customize-cra", {
        type: PackageDependencyType.DEV,
      });
      new GitIgnore(this, ["!config-overrides.js"]);
      reactScriptsCommand = "npx react-app-rewired";
    }

    if (props?.craco) {
      new PackageDependency(this, "@craco/craco", {
        type: PackageDependencyType.DEV,
      });
      new GitIgnore(this, ["!craco.config.ts", "!craco.config.js", "!.cracorc.ts", "!.cracorc.js", "!.cracorc"]);
      reactScriptsCommand = "yarn craco";
    }

    if (eslintSupport) {
      eslintSupport.fileExtensions.add("tsx");
      eslintSupport.plugins.delete("@typescript-eslint");
      eslintSupport.plugins.add("react-app");
      eslintSupport.plugins.add("react-hooks");
      eslintSupport.extends.delete("plugin:import/recommended");
      eslintSupport.extends.delete("plugin:import/typescript");
      eslintSupport.extends.add("plugin:react/jsx-runtime");

      new PackageDependency(this, "eslint-plugin-react-app", {
        type: PackageDependencyType.DEV,
      });
      new PackageDependency(this, "eslint-plugin-react-hooks", {
        type: PackageDependencyType.DEV,
      });
    }

    new ManifestEntry(this, "ReactScripts", {
      scripts: {
        start: `${reactScriptsCommand} start`,
        build: `${reactScriptsCommand} build`,
        test: `${reactScriptsCommand} test`,
        clean:
          'find . -name "*.js" -not -path "./node_modules/*" -not -name config-overrides.js -not -name setupProxy.js -delete && find . -name "*.d.ts" -not -path "./node_modules/*" -delete',
      },
      browserslist: [">0.2%", "not dead", "not op_mini all"],
    });

    if (JestSupport.hasSupport(this)) {
      new ManifestEntry(this, "JestFix", {
        jest: {
          collectCoverage: undefined as any,
          coverageDirectory: undefined as any,
          testPathIgnorePatterns: undefined as any,
          watchIgnorePatterns: undefined as any,
          reporters: undefined as any,
          preset: undefined as any,
        },
      });
    }
  }
}
