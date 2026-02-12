---
name: mermaid-diagram-specialist
description: Mermaid diagram creation patterns. Use when creating flowcharts, sequence diagrams, ER diagrams, class diagrams, or state diagrams.
---

# Mermaid Diagram Specialist

## Purpose

Create precise, well-structured Mermaid diagrams for software documentation. Covers flowcharts, sequence diagrams, ER diagrams, class diagrams, state diagrams, Gantt charts, and more. Provides syntax reference, best practices, and common patterns.

## Activation

Use this skill when the user asks to:

- Create or generate any kind of diagram
- Visualize architecture, flows, or relationships
- Document system interactions
- Create ER diagrams for database schemas
- Illustrate state machines or workflows

## Syntax Reference

### Flowchart

```mermaid
flowchart TD
    A[Start] --> B{Decision}
    B -->|Yes| C[Action 1]
    B -->|No| D[Action 2]
    C --> E[End]
    D --> E

    %% Node shapes
    F[Rectangle]
    G(Rounded)
    H([Stadium])
    I[[Subroutine]]
    J[(Database)]
    K((Circle))
    L>Asymmetric]
    M{Diamond}
    N{{Hexagon}}
    O[/Parallelogram/]
    P[\Parallelogram alt\]
    Q[/Trapezoid\]
    R[\Trapezoid alt/]
```

**Direction options:** `TD` (top-down), `LR` (left-right), `BT` (bottom-top), `RL` (right-left)

**Link styles:**

```
A --> B           %% Arrow
A --- B           %% Line
A -.-> B          %% Dotted arrow
A ==> B           %% Thick arrow
A -->|text| B     %% Arrow with text
A -- text --- B   %% Line with text
```

### Sequence Diagram

```mermaid
sequenceDiagram
    participant C as Client
    participant S as Server
    participant DB as Database

    C->>S: POST /api/users
    activate S
    S->>DB: INSERT INTO users
    activate DB
    DB-->>S: User record
    deactivate DB
    S-->>C: 201 Created
    deactivate S

    Note over C,S: Authentication flow
    Note right of S: Validate input

    alt Success
        S-->>C: 200 OK
    else Failure
        S-->>C: 400 Bad Request
    end

    loop Health Check
        S->>DB: SELECT 1
    end

    opt Optional step
        C->>S: GET /api/status
    end
```

**Arrow types:**

```
->>    Solid arrow (synchronous)
-->>   Dashed arrow (asynchronous/response)
-x     Solid with X (lost message)
--x    Dashed with X
-)     Solid open arrow
--)    Dashed open arrow
```

### Entity Relationship Diagram

```mermaid
erDiagram
    USER ||--o{ ORDER : places
    USER {
        uuid id PK
        string name
        string email UK
        timestamp created_at
    }
    ORDER ||--|{ ORDER_LINE : contains
    ORDER {
        uuid id PK
        uuid user_id FK
        decimal total
        string status
        timestamp ordered_at
    }
    ORDER_LINE {
        uuid id PK
        uuid order_id FK
        uuid product_id FK
        int quantity
        decimal unit_price
    }
    PRODUCT ||--o{ ORDER_LINE : "is in"
    PRODUCT {
        uuid id PK
        string name
        decimal price
        string category
    }
```

**Relationship types:**

```
||--||   One to one
||--o{   One to zero or more
||--|{   One to one or more
o{--o{   Zero or more to zero or more
```

### Class Diagram

```mermaid
classDiagram
    class Animal {
        <<abstract>>
        +String name
        +int age
        +makeSound()* void
        +move() void
    }
    class Dog {
        +String breed
        +makeSound() void
        +fetch() void
    }
    class Cat {
        +boolean indoor
        +makeSound() void
        +purr() void
    }
    class ISwimmable {
        <<interface>>
        +swim() void
    }

    Animal <|-- Dog : extends
    Animal <|-- Cat : extends
    ISwimmable <|.. Dog : implements
    Animal "1" --> "*" Food : eats
    Dog "1" o-- "1" Owner : has
```

**Relationship types:**

```
<|--    Inheritance
*--     Composition
o--     Aggregation
-->     Association
--      Link (solid)
..>     Dependency
..|>    Realization
```

**Visibility:**

```
+   Public
-   Private
#   Protected
~   Package/Internal
```

### State Diagram

```mermaid
stateDiagram-v2
    [*] --> Idle

    Idle --> Processing : submit
    Processing --> Success : complete
    Processing --> Failed : error
    Failed --> Processing : retry
    Success --> [*]
    Failed --> [*] : abandon

    state Processing {
        [*] --> Validating
        Validating --> Executing : valid
        Validating --> Failed : invalid
        Executing --> [*]
    }

    state "Fork Example" as fork
    state fork <<fork>>
    Processing --> fork
    fork --> Task1
    fork --> Task2

    note right of Processing
        Processing may take
        up to 30 seconds
    end note
```

### Gantt Chart

```mermaid
gantt
    title Project Timeline
    dateFormat  YYYY-MM-DD
    excludes    weekends

    section Planning
    Requirements    :done,    req,  2024-01-01, 14d
    Design          :done,    des,  after req,  10d

    section Development
    Backend API     :active,  api,  after des,  21d
    Frontend UI     :         ui,   after des,  28d
    Integration     :         int,  after api,  7d

    section Testing
    QA Testing      :         qa,   after int,  14d
    UAT             :         uat,  after qa,   7d

    section Release
    Deployment      :milestone, dep, after uat, 0d
```

### Pie Chart

```mermaid
pie title Technology Distribution
    "TypeScript" : 45
    "Python" : 25
    "Go" : 15
    "Rust" : 10
    "Other" : 5
```

### Git Graph

```mermaid
gitgraph
    commit id: "Initial"
    branch develop
    checkout develop
    commit id: "Feature A"
    commit id: "Feature B"
    checkout main
    merge develop id: "Release 1.0"
    branch hotfix
    checkout hotfix
    commit id: "Fix bug"
    checkout main
    merge hotfix id: "Patch 1.0.1"
```

## Best Practices

### Layout and Readability

1. **Use top-down for hierarchies**, left-right for sequences/flows
2. **Keep diagrams focused** - one concept per diagram, max 15-20 nodes
3. **Use subgraphs** to group related nodes in flowcharts
4. **Label all edges** with meaningful descriptions
5. **Use consistent naming** - PascalCase for classes, camelCase for methods, UPPER_SNAKE for tables

### Subgraph Organization

```mermaid
flowchart TD
    subgraph Frontend["Frontend Layer"]
        UI[React App]
        State[Redux Store]
    end

    subgraph Backend["Backend Layer"]
        API[REST API]
        Auth[Auth Service]
    end

    subgraph Data["Data Layer"]
        DB[(PostgreSQL)]
        Cache[(Redis)]
    end

    UI --> API
    UI --> State
    API --> Auth
    API --> DB
    API --> Cache
```

### Styling

```mermaid
flowchart TD
    A[Success]:::success --> B[Warning]:::warning --> C[Error]:::error

    classDef success fill:#d4edda,stroke:#28a745,color:#155724
    classDef warning fill:#fff3cd,stroke:#ffc107,color:#856404
    classDef error fill:#f8d7da,stroke:#dc3545,color:#721c24
    classDef default fill:#e2e3e5,stroke:#6c757d,color:#383d41
```

### Common Patterns

**API Flow:**

```mermaid
sequenceDiagram
    Client->>+API Gateway: Request
    API Gateway->>+Auth: Validate token
    Auth-->>-API Gateway: Token valid
    API Gateway->>+Service: Forward request
    Service->>+Database: Query
    Database-->>-Service: Results
    Service-->>-API Gateway: Response
    API Gateway-->>-Client: Response
```

**Microservice Architecture:**

```mermaid
flowchart LR
    subgraph Client
        Web[Web App]
        Mobile[Mobile App]
    end

    subgraph Gateway
        AG[API Gateway]
        LB[Load Balancer]
    end

    subgraph Services
        US[User Service]
        OS[Order Service]
        PS[Payment Service]
        NS[Notification Service]
    end

    subgraph Data
        UDB[(User DB)]
        ODB[(Order DB)]
        MQ[Message Queue]
    end

    Web & Mobile --> LB --> AG
    AG --> US & OS & PS
    US --> UDB
    OS --> ODB
    OS --> MQ
    MQ --> NS
    PS --> MQ
```

## Anti-Patterns to Avoid

| Anti-Pattern | Why It Is Bad | Fix |
|---|---|---|
| 50+ nodes in one diagram | Unreadable | Split into multiple diagrams |
| No edge labels | Relationships unclear | Add descriptive labels |
| Mixed abstraction levels | Confusing scope | One level per diagram |
| Using only rectangles | No visual distinction | Use appropriate shapes |
| No direction specified | Layout may surprise | Always specify `TD`, `LR`, etc. |
| Crossing lines everywhere | Hard to follow | Rearrange or split diagram |
