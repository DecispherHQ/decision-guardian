# Decision Guardian Mermaid Diagrams

Use the following Mermaid code to generate images for your documentation. You can use the [Mermaid Live Editor](https://mermaid.live/) to render them.

## 1. System Architecture

```mermaid
graph TD
    subgraph "Entry Points"
        Main["main.ts (Action)"]
        CLI["src/cli/index.ts (CLI)"]
    end

    subgraph "Core Engine"
        Parser["src/core/parser.ts"]
        Matcher["src/core/matcher.ts"]
        RuleEval["src/core/rule-evaluator.ts"]
        Metrics["src/core/metrics.ts"]
        Trie["src/core/trie.ts"]
        Logger["src/core/logger.ts"]
        Health["src/core/health.ts"]
    end

    subgraph "Adapters"
        GH_Adapter["GitHub Adapter"]
        Local_Adapter["Local Adapter"]
    end

    subgraph "Modules"
        Telemetry["Telemetry Module"]
    end

    Main --> Parser
    Main --> Matcher
    Main --> RuleEval
    CLI --> Parser
    CLI --> Matcher
    CLI --> RuleEval
    Main --> Metrics
    CLI --> Metrics
    Main --> GH_Adapter
    CLI --> Local_Adapter
    Metrics --> Telemetry
    Main --> Telemetry
    CLI --> Telemetry
```

## 2. Data Flow (GitHub Action)

```mermaid
sequenceDiagram
    participant GH as GitHub (PR Event)
    participant Main as main.ts
    participant Config as detailedConfig
    participant Parser as DecisionParser
    participant Provider as GitHubProvider
    participant Matcher as FileMatcher
    participant Metrics as Metrics
    participant Telemetry as Telemetry

    GH->>Main: Trigger Workflow
    Main->>Config: loadConfig()
    Main->>Main: checkDecisionFileExists()
    Main->>Parser: parseFile(decisionFile)
    Parser-->>Main: decisions[]
    Main->>Provider: getFileDiffs(pr_number)
    Provider-->>Main: changedFiles[]
    Main->>Matcher: findMatchesWithDiffs(decisions, changedFiles)
    Matcher-->>Main: matches[]
    Main->>Provider: postComment(matches)
    Main->>Metrics: reportMetrics()
    Main->>Telemetry: sendTelemetry()
```

## 3. CLI Action Flow

```mermaid
sequenceDiagram
    participant User
    participant CLI as CLI (check)
    participant Parser as DecisionParser
    participant Git as LocalGitProvider
    participant Matcher as FileMatcher
    participant Formatter as TableFormatter
    participant Telemetry

    User->>CLI: decision-guardian check
    CLI->>Parser: parseFile()
    Parser-->>CLI: decisions[]
    CLI->>Git: getFileDiffs()
    Git-->>CLI: changedFiles[]
    CLI->>Matcher: findMatchesWithDiffs()
    Matcher-->>CLI: matches[]
    CLI->>Formatter: formatMatchesTable(matches)
    Formatter-->>User: Console Output
    CLI->>Telemetry: sendTelemetry()
    CLI->>User: Exit Process
```

## 4. High-Level Logic Flow

```mermaid
flowchart TD
    Start[Start] --> LoadConfig[Load Configuration]
    LoadConfig --> ValidateConfig{Valid Config?}
    ValidateConfig -- No --> Error[Exit with Error]
    ValidateConfig -- Yes --> ParseDecisions[Parse Decisions File]
    ParseDecisions --> GetDiffs[Get Git Diffs]
    GetDiffs --> BuildTrie[Build Pattern Trie]
    BuildTrie --> LoopFiles{For Each File}
    LoopFiles -- Done --> GenerateComment[Generate Comment/Output]
    LoopFiles -- Next File --> CheckMatch{Match Trie?}
    CheckMatch -- No --> LoopFiles
    CheckMatch -- Yes --> CheckRules{Advanced Rules?}
    CheckRules -- No --> AddMatch[Add to Matches]
    CheckRules -- Yes --> EvalRules[Evaluate Rules]
    EvalRules -- Fail --> LoopFiles
    EvalRules -- Pass --> AddMatch
    AddMatch --> LoopFiles
    GenerateComment --> CheckSeverity{Critical Violation?}
    CheckSeverity -- Yes --> Fail[Fail Build (if configured)]
    CheckSeverity -- No --> Success[Pass Build]
```
