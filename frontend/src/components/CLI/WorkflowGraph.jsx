import './WorkflowGraph.css';

export function WorkflowGraph({ steps }) {
  // Build dependency map
  const getDependencies = (step) => {
    if (!step.dependsOn) return [];
    return step.dependsOn.split(',').map(s => s.trim()).filter(Boolean);
  };

  // Find step index by ID
  const getStepIndex = (id) => steps.findIndex(s => s.id === id);

  return (
    <div className="workflow-graph">
      <div className="graph-header">
        <h4>Workflow Graph</h4>
        <span className="graph-hint">{steps.length} steps</span>
      </div>

      <div className="graph-container">
        <svg className="graph-connections" width="100%" height="100%">
          {steps.map((step, index) => {
            const deps = getDependencies(step);
            return deps.map(depId => {
              const depIndex = getStepIndex(depId);
              if (depIndex === -1) return null;

              // Calculate connection line
              const startY = depIndex * 80 + 40;
              const endY = index * 80 + 40;
              const startX = 180;
              const endX = 20;
              const midX = (startX + endX) / 2;

              return (
                <g key={`${depId}-${step.id}`}>
                  <path
                    d={`M ${startX} ${startY} C ${midX} ${startY}, ${midX} ${endY}, ${endX} ${endY}`}
                    className="connection-line"
                  />
                  <circle cx={endX} cy={endY} r="4" className="connection-dot" />
                </g>
              );
            });
          })}
        </svg>

        <div className="graph-nodes">
          {steps.map((step, index) => {
            const stepType = step.type || 'command';
            const deps = getDependencies(step);
            const hasDeps = deps.length > 0;

            return (
              <div
                key={step.id || index}
                className={`graph-node ${stepType} ${hasDeps ? 'has-deps' : ''}`}
              >
                <div className="node-index">{index + 1}</div>
                <div className="node-content">
                  <div className="node-header">
                    <span className={`node-type ${stepType}`}>
                      {stepType === 'http' ? 'HTTP' : 'CMD'}
                    </span>
                    <span className="node-name">
                      {step.name || step.id || `Step ${index + 1}`}
                    </span>
                  </div>
                  <div className="node-detail">
                    {stepType === 'http' ? (
                      <>
                        <span className="node-method">{step.http?.method || 'GET'}</span>
                        <span className="node-target">{step.http?.url || 'No URL'}</span>
                        {step.http?.polling?.enabled && (
                          <span className="node-polling">
                            Poll: {step.http.polling.intervalSeconds || 30}s / {step.http.polling.maxDurationMinutes || 60}m
                          </span>
                        )}
                      </>
                    ) : (
                      <>
                        <span className="node-target">{step.args || 'No arguments'}</span>
                        {step.args && <span className="node-args">{step.args}</span>}
                      </>
                    )}
                  </div>
                  {hasDeps && (
                    <div className="node-deps">
                      Depends on: {deps.join(', ')}
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {steps.length === 0 && (
        <div className="graph-empty">
          <p>Add steps to see the workflow graph</p>
        </div>
      )}
    </div>
  );
}
