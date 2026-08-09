import { useState, useCallback, useEffect } from "react";
import { compact } from "../lib/format";
import { api } from "../lib/api";

interface TreeNode {
  name: string;
  type: "blob" | "tree" | "commit";
  sha: string;
  path: string;
  size?: number;
}

interface RepoCommit {
  sha: string;
  message: string;
  author: string;
  date: string;
  url: string;
}

function TreeViewer({ repo }: { repo: string }) {
  const [tree, setTree] = useState<TreeNode[]>([]);
  const [loading, setLoading] = useState(false);
  const [path, setPath] = useState("");
  const [selectedFile, setSelectedFile] = useState<TreeNode | null>(null);

  const loadTree = useCallback(async () => {
    setLoading(true);
    try {
      const res = await api.repoTree(repo, path);
      setTree(res.tree ?? []);
    } catch (err) {
      console.error("Failed to load tree:", err);
    } finally {
      setLoading(false);
    }
  }, [repo, path]);

  useEffect(() => {
    void loadTree();
  }, [loadTree]);

  const navigateToTree = (nodePath: string) => {
    if (nodePath === path) setPath("");
    else setPath(nodePath);
    setSelectedFile(null);
  };

  return (
    <div className="repo-section">
      <div className="repo-tree">
        <div className="hud-label">Tree · {path || "root"}</div>
        {loading && <p className="hud-label">Loading…</p>}
        <ul className="tree-list">
          {tree.map((node) => (
            <li key={node.sha}>
              {node.type === "tree" ? (
                <button
                  className="tree-item tree-item--dir"
                  onClick={() => navigateToTree(node.path)}
                >
                  <span className="tree-item__icon">{"▶"}</span>
                  <span className="tree-item__name">{node.name}</span>
                </button>
              ) : (
                <button
                  className="tree-item tree-item--file"
                  onClick={() => setSelectedFile(node)}
                  data-selected={selectedFile?.sha === node.sha}
                >
                  <span className="tree-item__icon">{"📄"}</span>
                  <span className="tree-item__name">{node.name}</span>
                  {node.size !== undefined && (
                    <span className="tree-item__size mono">{compact(node.size)}</span>
                  )}
                </button>
              )}
            </li>
          ))}
        </ul>
      </div>

      {selectedFile && selectedFile.type === "blob" && (
        <div className="repo-file">
          <div className="hud-label">{selectedFile.name}</div>
          <div className="file-viewer">
            <div className="file-viewer__meta mono">
              <span>{selectedFile.path}</span>
              <span>{compact(selectedFile.size)} bytes</span>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function CommitLog({ repo }: { repo: string }) {
  const [commits, setCommits] = useState<RepoCommit[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    const load = async () => {
      setLoading(true);
      try {
        const res = await api.repoCommits(repo);
        setCommits(res.commits ?? []);
      } catch (err) {
        console.error("Failed to load commits:", err);
      } finally {
        setLoading(false);
      }
    };
    void load();
  }, [repo]);

  return (
    <div className="repo-section">
      <div className="hud-label">Recent commits</div>
      {loading && <p className="hud-label">Loading…</p>}
      <ol className="commit-log">
        {commits.map((c) => (
          <li key={c.sha} className="commit">
            <div className="commit__sha mono">{c.sha.slice(0, 7)}</div>
            <div className="commit__body">
              <div className="commit__msg">{c.message.split("\n")[0]}</div>
              <div className="commit__meta mono">{c.author} · {c.date}</div>
            </div>
          </li>
        ))}
      </ol>
    </div>
  );
}

export function RepoConsole() {
  const [repos, setRepos] = useState<string[]>([]);
  const [selectedRepo, setSelectedRepo] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const load = async () => {
      setLoading(true);
      try {
        const res = await api.repoList();
        const repoList = res.repos ?? [];
        setRepos(repoList);
        if (repoList.length > 0) setSelectedRepo(repoList[0]);
      } catch (err) {
        console.error("Failed to load repos:", err);
      } finally {
        setLoading(false);
      }
    };
    void load();
  }, []);

  if (loading) {
    return (
      <div className="screen">
        <div className="panel locked">
          <span className="hud-label">Loading repositories…</span>
        </div>
      </div>
    );
  }

  if (repos.length === 0) {
    return (
      <div className="screen">
        <div className="panel bracket locked">
          <div className="locked__title">No GitHub integration yet</div>
          <p className="locked__body">
            Link your GitHub account in phase 3 to browse repositories, read files,
            and view commits.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="screen">
      <div className="screen__head">
        <h1 className="screen__title">Repo Console</h1>
        <p className="screen__sub">
          Browse trees, read files, diff, and open PRs. Never a push to main.
        </p>
      </div>

      <div className="repo-selector">
        <label className="hud-label">Repository</label>
        <select
          value={selectedRepo ?? ""}
          onChange={(e) => setSelectedRepo(e.target.value)}
          className="repo-select"
        >
          {repos.map((repo) => (
            <option key={repo} value={repo}>{repo}</option>
          ))}
        </select>
      </div>

      {selectedRepo && (
        <div className="repo-layout">
          <TreeViewer repo={selectedRepo} />
          <CommitLog repo={selectedRepo} />
        </div>
      )}
    </div>
  );
}
