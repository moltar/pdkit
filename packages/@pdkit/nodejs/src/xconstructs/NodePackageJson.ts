import { ValidLicense, Manifest, XConstruct } from "../../../core/src";
import { NodeProject } from "./NodeProject";

export interface NodePackageJsonProps {
  readonly name?: string;
  readonly description?: string;
  readonly version?: string;
  readonly private?: boolean;
  readonly license?: ValidLicense;
  readonly homepath?: string;
  readonly repository?: string;
  readonly keywords?: string[];
  readonly main?: string;
  readonly bin?: Record<string, string>;
  readonly scripts?: Record<string, string>;
  readonly bugs?: {
    readonly url?: string;
    readonly email?: string;
  };
  readonly files?: string[];
  readonly man?: string[];
}

export class NodePackageJson extends Manifest {
  constructor(scope: XConstruct, id: string, props?: NodePackageJsonProps) {
    super(scope, id, "package.json");

    if (props) {
      this.addFields({
        name: props.name,
        description: props.description,
        version: props.version ?? "0.0.0",
        private: props.private,
        homepath: props.homepath,
        repository: props.repository,
        keywords: props.keywords,
        main: props.main,
        bin: props.bin,
        scripts: props.scripts,
        bugs: props.bugs,
        files: props.files,
        man: props.man,
      });
    }
  }

  _synth() {
    super._synth();

    const existingPackageFile = NodeProject.of(this).tryReadFile("package.json");
    let packageJson: { [key: string]: any } = {};

    if (existingPackageFile) {
      packageJson = JSON.parse(existingPackageFile.toString("utf8"));
    }

    ["dependencies", "devDependencies", "peerDependencies", "bundledDependencies"].forEach((key) => {
      if (this.fields[key]) {
        const deps = this.fields[key] as { [key: string]: string };

        Object.keys(deps).forEach((d) => {
          if (deps[d] === "*" && packageJson[key] && packageJson[key][d]) {
            this.addFields({
              [key]: {
                [d]: packageJson[key][d],
              },
            });
          }
        });
      }
    });
  }
}
