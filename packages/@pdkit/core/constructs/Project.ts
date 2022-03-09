import path from "path";
import { IXConstruct, XConstruct } from "../base/XConstruct";
import { ConstructError } from "../util/ConstructError";

export interface IProject extends IXConstruct {
  readonly projectRelativeSourcePath: string;
  readonly projectPath: string;
  readonly distPath: string;
}

export interface ProjectProps {
  readonly projectPath?: string;
  readonly sourcePath?: string;
  readonly distPath?: string;
}

type Constructor<T> = abstract new (...args: any[]) => any;

export abstract class Project extends XConstruct implements IProject {
  public static is(construct: any) {
    return construct instanceof this;
  }

  public static of(construct: any): Project {
    if (!(construct instanceof XConstruct)) {
      throw new Error(`${construct} is not a construct`);
    }

    if (construct instanceof Project) {
      return construct;
    }

    let project = (construct as XConstruct).node.scopes
      .reverse()
      .find((scope) => scope !== construct && scope instanceof Project);

    if (!project) {
      throw new ConstructError(construct, `Construct must be a child of a project or workspace`);
    }

    return project as Project;
  }

  private readonly _projectPath?: string;
  private readonly _sourcePath: string;
  private readonly _distPath: string;

  constructor(scope: XConstruct, id: string, props?: ProjectProps) {
    super(scope, id);

    this._projectPath = props?.projectPath;
    this._sourcePath = props?.sourcePath ?? ".";
    this._distPath = props?.distPath ?? ".";

    this.node.addValidation({
      validate: () => {
        const errors: string[] = [];
        const parentProject = Project.of(this);

        if (!parentProject && !this._projectPath) {
          errors.push("Nested projects must explicitly define a projectPath");
        }

        return errors;
      },
    });
  }

  /**
   * Find all nodes by type that are owned by this project. Ownership is determined by the closest project scoped to a node.
   * @param childType
   */
  public tryFindDeepChildren<
    T extends Constructor<any> = Constructor<any>,
    TRet extends InstanceType<T> = InstanceType<T>
  >(childType: T): TRet[] {
    const parentProject = Project.of(this);

    return this.node
      .findAll()
      .filter((c) => c instanceof childType)
      .filter((c) => Project.of(c) === parentProject) as TRet[];
  }

  /**
   * Find all nodes by type that are owned by this project. Ownership is determined by the closest project scoped to a node.
   * Undefined is returned if the number of matching children is not exactly one.
   * @param childType
   */
  public tryFindDeepChild<
    T extends Constructor<any> = Constructor<any>,
    TRet extends InstanceType<T> = InstanceType<T>
  >(childType: T): TRet | undefined {
    const children = this.tryFindDeepChildren(childType);

    return (children.length === 1 && children[0]) || undefined;
  }

  /**
   * Find all nodes by type that are owned by this project. Ownership is determined by the closest project scoped to a node.
   * An error is thrown if the number of matching children is not exactly one.
   * @param childType
   */
  public findDeepChild<T extends Constructor<any> = Constructor<any>, TRet extends InstanceType<T> = InstanceType<T>>(
    childType: T
  ): TRet {
    const child = this.tryFindDeepChild(childType);

    if (!child) {
      throw new ConstructError(this, `Project does not own a ${childType}`);
    }

    return child;
  }

  get parentProject() {
    return Project.of(this);
  }

  get projects(): Project[] {
    return this.tryFindDeepChildren(Project);
  }

  get projectPath(): string {
    const parent = this.node.scopes.reverse().find((scope) => scope !== this && Project.is(scope)) as
      | Project
      | undefined;

    return path.join(parent ? parent.projectPath : "/", this._projectPath ?? "");
  }

  get projectRelativeSourcePath(): string {
    return path.join(this.projectPath, this._sourcePath).substring(1);
  }

  get sourcePath(): string {
    return this._sourcePath;
  }

  get distPath(): string {
    return this._distPath;
  }
}
