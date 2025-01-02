# Problem Test Maker - Technical Documentation

## Project Structure

```
/src
  /python_dist/          # Python build output
    problem_cutter/      # ProblemCutter onedir build
  /lib/                  # Core JavaScript modules
    test-maker.js
    xml-builder.js
    utils.js
  main.js               # Electron main process
  renderer.js           # Electron renderer process
  preload.js            # Security preload script
  /config
    constants.js        # Constants and configurations
```

## Core Components

### 1. TestMaker (lib/test-maker.js)

Primary class responsible for generating QTI packages from image sets.

#### Configuration

```javascript
{
  mediaDir: string,        // Default: process.env.MEDIA_DIR
  questionSuffix: string,  // Default: process.env.QUESTION_SUFFIX
  choicePattern: number[], // Default: JSON.parse(process.env.CHOICE_PATTERN)
  tempDir: string         // Temporary directory for package creation
}
```

#### Methods

- `createPackage(inputDir, outputDir, name)`: Creates a QTI package
  - Input: Directory containing problem images
  - Output: ZIP file containing QTI package
  - Returns: Path to created ZIP file

#### Image File Structure

- Question images: `{name}{number:02d}{questionSuffix}.png`
- Choice images: `{name}{number:02d}{choice}.png`
  - Example: For question 1
    - Question: `test019.png`
    - Choices: `test010.png`, `test011.png`, etc.

### 2. XML Builder (lib/xml-builder.js)

Handles creation of QTI XML files.

#### Main Functions

- `createQuizXml(name, images, config)`

  - Creates assessment XML with questions and choices
  - Schema version: 1.1.3
  - Returns valid QTI XML string

- `createManifestXml(name, assessmentId, images)`
  - Creates IMS manifest XML
  - Includes resource references for all images
  - Returns valid manifest XML string

#### XML Structure Requirements

1. Assessment XML

```xml
<?xml version="1.0" encoding="UTF-8"?>
<questestinterop>
  <assessment ident="{uuid}" title="{name}">
    <qtimetadata>
      <qtimetadatafield>
        <fieldlabel>qmd_timelimit</fieldlabel>
        <fieldentry>{timeLimit}</fieldentry>
      </qtimetadatafield>
    </qtimetadata>
    <section ident="root_section">
      <!-- Question items -->
    </section>
  </assessment>
</questestinterop>
```

2. Manifest XML

```xml
<?xml version="1.0" encoding="UTF-8"?>
<manifest identifier="{uuid}">
  <metadata>
    <schema>IMS Content</schema>
    <schemaversion>1.1.3</schemaversion>
  </metadata>
  <organizations/>
  <resources>
    <!-- Resource entries -->
  </resources>
</manifest>
```

### 3. Package Structure

Final ZIP package should contain:

```
{name}.zip
├── imsmanifest.xml
├── {assessment-id}/
│   └── {assessment-id}.xml
└── {mediaDir}/
    ├── question1.png
    ├── choice1-1.png
    └── ...
```

## Implementation Notes

1. Error Handling

   - Use try-catch blocks for file operations
   - Implement cleanup in finally blocks
   - Propagate meaningful error messages

2. File Operations

   - Use async/await for all file operations
   - Ensure proper cleanup of temporary files
   - Handle file name collisions

3. XML Generation

   - Use a reliable XML library (e.g., xmlbuilder2)
   - Ensure proper encoding (UTF-8)
   - Validate XML structure

4. Package Creation
   - Use 'archiver' for ZIP creation
   - Include all required files
   - Maintain directory structure

## Environment Variables

```
MEDIA_DIR=업로드 된 미디어
QUESTION_SUFFIX=9
CHOICE_PATTERN=[0,1,2,3]
TEMP_DIR=./temp
```

## Dependencies

Required npm packages:

```json
{
  "archiver": "^5.3.1",
  "uuid": "^9.0.0",
  "xmlbuilder2": "^3.1.1"
}
```
