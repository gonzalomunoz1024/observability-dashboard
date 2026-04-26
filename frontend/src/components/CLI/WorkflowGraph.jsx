import './WorkflowGraph.css';

// Generate consistent color for a variable name (no yellows, good contrast)
const getVarColor = (varName) => {
  const colors = [
    '#FF6B6B', '#4ECDC4', '#45B7D1', '#9B59B6',
    '#3498DB', '#E74C3C', '#1ABC9C', '#8E44AD',
    '#2ECC71', '#E67E22', '#16A085', '#C0392B'
  ];
  let hash = 0;
  for (let i = 0; i < varName.length; i++) {
    hash = varName.charCodeAt(i) + ((hash << 5) - hash);
  }
  return colors[Math.abs(hash) % colors.length];
};

export function WorkflowGraph({ steps }) {
  // Parse captured variables from capture array
  const getCapturedVars = (step) => {
    const vars = [];
    if (Array.isArray(step.capture)) {
      step.capture.forEach(item => {
        if (item.varName) vars.push(item.varName);
      });
    }
    if (Array.isArray(step.artifacts)) {
      step.artifacts.forEach(item => {
        if (item.varName) vars.push(item.varName);
      });
    }
    if (Array.isArray(step.http?.capture)) {
      step.http.capture.forEach(item => {
        if (item.varName) vars.push(item.varName);
      });
    }
    return vars;
  };

  // Parse artifacts from artifacts array
  const getArtifacts = (step) => {
    if (!Array.isArray(step.artifacts)) return [];
    return step.artifacts.filter(item => item.path).map(item => ({
      path: item.path,
      varName: item.varName
    }));
  };

  // Check if a step uses variables from previous steps
  const getUsedVars = (step) => {
    const vars = [];
    const checkForVars = (str) => {
      if (!str || typeof str !== 'string') return;
      const matches = str.match(/\{\{(\w+)\}\}/g);
      if (matches) {
        matches.forEach(m => {
          const varName = m.replace(/[{}]/g, '');
          if (varName !== 'workDir' && varName !== 'uuid') {
            vars.push(varName);
          }
        });
      }
    };
    checkForVars(step.args);
    if (Array.isArray(step.artifacts)) {
      step.artifacts.forEach(item => checkForVars(item.path));
    }
    checkForVars(step.http?.url);
    checkForVars(step.http?.body);
    return [...new Set(vars)];
  };

  // Build variable flow map: which step captures which var, which step uses it
  const buildVarFlows = () => {
    const flows = [];
    const varSources = {}; // varName -> stepIndex

    steps.forEach((step, index) => {
      // Record captures
      getCapturedVars(step).forEach(varName => {
        varSources[varName] = index;
      });

      // Record usages and create flows
      getUsedVars(step).forEach(varName => {
        if (varSources[varName] !== undefined && varSources[varName] < index) {
          flows.push({
            varName,
            fromStep: varSources[varName],
            toStep: index,
            color: getVarColor(varName)
          });
        }
      });
    });

    return flows;
  };

  const varFlows = buildVarFlows();

  return (
    <div className="workflow-graph">
      <div className="graph-header">
        <h4>Data Flow</h4>
        <span className="graph-hint">{steps.length} steps</span>
      </div>

      <div className="graph-container">
        <div className="graph-nodes">
          {steps.map((step, index) => {
            const stepType = step.type || 'command';
            const capturedVars = getCapturedVars(step);
            const artifacts = getArtifacts(step);
            const usedVars = getUsedVars(step);

            // Find flows into this step
            const incomingFlows = varFlows.filter(f => f.toStep === index);
            // Find flows out of this step
            const outgoingFlows = varFlows.filter(f => f.fromStep === index);

            return (
              <div key={step.id || index} className="flow-step">
                {/* Incoming data flow */}
                {incomingFlows.length > 0 && (
                  <div className="flow-incoming">
                    {incomingFlows.map((flow, i) => (
                      <div key={i} className="flow-connector incoming">
                        <div className="flow-line" style={{ backgroundColor: flow.color }} />
                        <span className="flow-var" style={{ backgroundColor: flow.color }}>
                          {`{{${flow.varName}}}`}
                        </span>
                        <div className="flow-arrow" style={{ borderTopColor: flow.color }} />
                      </div>
                    ))}
                  </div>
                )}

                {/* Step card */}
                <div className={`graph-node ${stepType}`}>
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
                      <span className="node-target">
                        {stepType === 'http'
                          ? `${step.http?.method || 'GET'} ${step.http?.url || ''}`
                          : step.args || 'No arguments'}
                      </span>
                    </div>

                    {/* Show what this step uses */}
                    {usedVars.length > 0 && (
                      <div className="node-uses">
                        <span className="uses-label">Uses</span>
                        {usedVars.map(v => (
                          <span
                            key={v}
                            className="var-pill uses"
                            style={{ backgroundColor: getVarColor(v) + '30', borderColor: getVarColor(v) }}
                          >
                            {`{{${v}}}`}
                          </span>
                        ))}
                      </div>
                    )}

                    {/* Show what this step captures/creates */}
                    {(capturedVars.length > 0 || artifacts.length > 0) && (
                      <div className="node-produces">
                        {capturedVars.map(v => (
                          <span
                            key={v}
                            className="var-pill captures"
                            style={{ backgroundColor: getVarColor(v), color: '#fff' }}
                          >
                            {`{{${v}}}`}
                          </span>
                        ))}
                        {artifacts.map((a, i) => (
                          <span key={i} className="artifact-pill">
                            {a.path}
                          </span>
                        ))}
                      </div>
                    )}
                  </div>
                </div>

                {/* Outgoing data flow */}
                {outgoingFlows.length > 0 && (
                  <div className="flow-outgoing">
                    {outgoingFlows.map((flow, i) => (
                      <div key={i} className="flow-connector outgoing">
                        <div className="flow-line" style={{ backgroundColor: flow.color }} />
                      </div>
                    ))}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>

      {steps.length === 0 && (
        <div className="graph-empty">
          <p>Add steps to see the data flow</p>
        </div>
      )}
    </div>
  );
}
