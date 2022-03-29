import path from "path";
import { LifeCycle, Manifest, Project, ValidLicense, Workspace, XConstruct } from "../../core";
import { NodeProject } from "../project";

export interface NodePackageJsonProps {
  readonly name?: string;
  readonly description?: string;
  readonly version?: string;
  readonly private?: boolean;
  readonly license?: ValidLicense;
  readonly homepath?: string;
  readonly repository?: string | { readonly type: string; readonly url: string };
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

export class PackageJson extends Manifest {
  constructor(scope: XConstruct, props?: NodePackageJsonProps) {
    super(scope, "package.json");

    const project = Project.of(this);

    const packageJson = Workspace.of(this).fileSynthesizer.tryReadRealJsonFile<{ [key: string]: any }>(
      this,
      path.join(project.projectPath, "package.json")
    );

    if (props) {
      this.addShallowFields({
        name: props.name,
        description: props.description,
        version: packageJson?.version ?? props.version ?? "0.0.0",
        private: props.private,
        homepath: props.homepath,
        repository: props.repository,
        keywords: props.keywords,
        main: props.main ?? `${project.distPath}/index.js`,
        bin: props.bin,
        scripts: props.scripts,
        bugs: props.bugs,
        files: props.files,
        man: props.man,
      });
    }

    this.addLifeCycleScript(LifeCycle.SYNTH, () => {
      const addPackageDependency = (key: string, packageName: string, version: string) => {
        this.addDeepFields({
          [key]: {
            [packageName]: version,
          },
        });
      };

      const projects = Workspace.of(this)
        .node.findAll()
        .filter((p) => p instanceof NodeProject) as NodeProject[];

      ["dependencies", "devDependencies", "peerDependencies", "bundledDependencies"].forEach((key) => {
        if (this.fields[key]) {
          const field = this.fields[key] as Record<string, string>;

          for (const dep of Object.keys(field)) {
            if (field[dep] && field[dep] !== "*") {
              addPackageDependency(key, dep, field[dep]);
            } else {
              const pj = projects.find((p) => p.node.id === key);

              if (pj) {
                addPackageDependency(key, dep, `^${pj.packageJson.version}`);
              } else {
                const version = this.resolveDepVersion(dep);

                addPackageDependency(key, dep, version);
              }
            }
          }
        }

        // We need to sort our dependency keys to match npm/yarn
        if (this.fields[key]) {
          this.fields[key] = Object.keys(this.fields[key] as any)
            .sort()
            .reduce((c, k) => {
              c[k] = (this.fields[key] as Record<string, string>)[k];

              return c;
            }, {} as Record<string, string>);
        }
      });

      // This determines the order at which package.json is written and is for visual purposes only
      const packageOrdering = [
        "name",
        "description",
        "license",
        "repository",
        "version",
        "author",
        "bugs",
        "private",
        "main",
        "bin",
        "man",
        "scripts",
        "files",
        "workspaces",
        "dependencies",
        "devDependencies",
        "peerDependencies",
        "bundledDependencies",
        "resolutions",
      ];

      this._fields = Object.keys(this._fields)
        .sort((a, b) => {
          if (packageOrdering.indexOf(a) !== -1 && packageOrdering.indexOf(b) === -1) return -1;
          if (packageOrdering.indexOf(a) === -1 && packageOrdering.indexOf(b) !== -1) return 1;
          return packageOrdering.indexOf(a) - packageOrdering.indexOf(b);
        })
        .reduce((c, k) => {
          c[k] = this._fields[k];

          return c;
        }, {} as Record<string, unknown>);
    });
  }

  get version() {
    return this.fields.version as string;
  }

  resolveDepVersion(dep: string) {
    const project = Project.of(this);
    const workspace = Workspace.of(this);

    const packageJson =
      workspace.fileSynthesizer.tryReadRealJsonFile<{ [key: string]: any }>(this, `node_modules/${dep}/package.json`) ||
      workspace.fileSynthesizer.tryReadRealJsonFile<{ [key: string]: any }>(
        this,
        `${project.projectPath}/node_modules/${dep}/package.json`
      );

    return packageJson?.version ?? "*";
  }

  protected transform(fields: Record<string, unknown>): string {
    return super.transform(fields) + "\n";
  }
}