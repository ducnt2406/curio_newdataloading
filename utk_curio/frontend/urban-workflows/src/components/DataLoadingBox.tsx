import React, { useEffect, useState, useRef } from "react";
import { Handle, Position } from "reactflow";
import BoxEditor from "./editing/BoxEditor";

// Bootstrap
import "bootstrap/dist/css/bootstrap.min.css";
import { BoxType } from "../constants";
import "./Box.css";

import { Template, useTemplateContext } from "../providers/TemplateProvider";
import { BoxContainer, buttonStyle } from "./styles";
import CSS from "csstype";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import {
  faGear,
  faCircleInfo,
  faFileArrowUp,
} from "@fortawesome/free-solid-svg-icons";

import TemplateModal from "./TemplateModal";
import DescriptionModal from "./DescriptionModal";
import { useUserContext } from "../providers/UserProvider";
import { OutputIcon } from "./edges/OutputIcon";
import { PythonInterpreter } from "../PythonInterpreter";
import { useFlowContext } from "../providers/FlowProvider";
import { useProvenanceContext } from "../providers/ProvenanceProvider";

function DataLoadingBox({ data, isConnectable }) {
  const [output, setOutput] = useState<{
    code: string;
    content: string;
    outputType: string;
  }>({
    code: "",
    content: "",
    outputType: "",
  }); // stores the output produced by the last execution of this box
  const [code, setCode] = useState<string>(
    "# Select a file to generate pandas code"
  );
  const [sendCode, setSendCode] = useState<(() => void) | undefined>(undefined);
  const [templateData, setTemplateData] = useState<Template | any>({});
  const [newTemplateFlag, setNewTemplateFlag] = useState(false);
  const [showTemplateModal, setShowTemplateModal] = useState(false);
  const [showDescriptionModal, setDescriptionModal] = useState(false);

  // New state for file upload functionality
  const [showUploadButton, setShowUploadButton] = useState(true);
  const [filePath, setFilePath] = useState<string>("");
  const [fileLink, setFileLink] = useState<string>("");
  const [fileInfo, setFileInfo] = useState<{
    name: string;
    size: number;
    type: string;
    lastModified: number;
  } | null>(null);

  const fileInputRef = useRef<HTMLInputElement>(null);

  const { editUserTemplate } = useTemplateContext();
  const { user } = useUserContext();
  const { workflowNameRef } = useFlowContext();
  const { boxExecProv } = useProvenanceContext();

  // Python interpreter for code execution
  const pythonInterpreter = useRef(new PythonInterpreter());

  useEffect(() => {
    if (data && typeof code === "string") {
      data.code = code;
      console.log("Updated data.code:", data.code);
    }
  }, [code, data]);

  useEffect(() => {
    data.output = output;
  }, [output]);

  useEffect(() => {
    if (data.templateId != undefined) {
      setTemplateData({
        id: data.templateId,
        type: BoxType.DATA_LOADING,
        name: data.templateName,
        description: data.description,
        accessLevel: data.accessLevel,
        code: data.defaultCode,
        custom: data.customTemplate,
      });
    }
  }, [data.templateId]);

  const setTemplateConfig = (template: Template) => {
    setTemplateData({ ...template });
  };

  const promptModal = (newTemplate: boolean = false) => {
    setNewTemplateFlag(newTemplate);
    setShowTemplateModal(true);
  };

  const closeModal = () => {
    setShowTemplateModal(false);
  };

  const promptDescription = () => {
    setDescriptionModal(true);
  };

  const closeDescription = () => {
    setDescriptionModal(false);
  };

  const updateTemplate = (template: Template) => {
    setTemplateConfig(template);
    editUserTemplate(template);
  };

  const setSendCodeCallback = (_sendCode: any) => {
    setSendCode(() => _sendCode);
  };

  const handleFileClick = () => {
    fileInputRef.current?.click();
  };

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) {
      console.log("No file selected");
      return;
    }

    try {
      // Store the file information
      setFilePath(file.name);
      setFileInfo({
        name: file.name,
        size: file.size,
        type: file.type || "unknown",
        lastModified: file.lastModified,
      });

      // Upload file to server first
      console.log("Uploading file to server...");
      const formData = new FormData();
      formData.append("file", file);

      let serverFilePath = "";

      try {
        const backendUrl =
          process.env.REACT_APP_BACKEND_URL || "http://localhost:2000";
        console.log("Attempting upload to:", `${backendUrl}/upload`);

        const response = await fetch(`${backendUrl}/upload`, {
          method: "POST",
          body: formData,
        });

        console.log("Upload response status:", response.status);
        console.log("Upload response ok:", response.ok);

        if (response.ok) {
          const responseText = await response.text();
          console.log("Raw server response:", responseText);

          let result;
          try {
            result = JSON.parse(responseText);
            console.log("Parsed server response:", result);
          } catch (parseError) {
            console.error(
              "Failed to parse server response as JSON:",
              parseError
            );
            console.log("Response was not JSON, treating as old format");
            // Fallback for old server response format
            if (responseText.includes("File uploaded successfully")) {
              // Old format - construct our own response
              serverFilePath = `data/${file.name}`;
              console.log("Using fallback file path:", serverFilePath);
              setFileLink(serverFilePath);
            } else {
              setCode("# Error: Server response was not in expected format");
              return;
            }
          }

          if (result) {
            // New JSON format
            if (result.success && result.file_path) {
              serverFilePath = result.file_path;
              console.log("Using server file path for pandas:", serverFilePath);
              console.log("Full server path:", result.full_path);

              // Set the file link to the server path
              setFileLink(serverFilePath);
            } else {
              console.error(
                "Server upload failed or no file path returned:",
                result
              );
              setCode(`# Error: Server response: ${JSON.stringify(result)}`);
              return;
            }
          }
        } else {
          const errorText = await response.text();
          console.error(
            "Server upload failed:",
            response.status,
            response.statusText
          );
          console.error("Error response:", errorText);
          setCode(
            `# Error: Server upload failed (${response.status}): ${errorText}`
          );
          return;
        }
      } catch (uploadError) {
        console.error("Error uploading to server:", uploadError);
        const errorMessage =
          uploadError instanceof Error
            ? uploadError.message
            : String(uploadError);
        setCode(`# Error: Could not connect to server: ${errorMessage}`);
        return;
      }

      // Only generate pandas code if we have a valid server file path
      if (!serverFilePath || serverFilePath.startsWith("blob:")) {
        console.error("Cannot generate pandas code: no valid server file path");
        setCode(
          "# Error: File must be uploaded to server before generating pandas code"
        );
        return;
      }

      // Generate pandas code with server file path (formatted for PythonInterpreter)
      const pandasCode = `import pandas as pd
# Load data from uploaded file
# Server file path: ${serverFilePath}
df = pd.read_csv('${serverFilePath}')
print("Data loaded successfully!")
print(f"Shape: {df.shape}")
print("\nFirst 5 rows:")
print(df.head())

# Return the dataframe for use in downstream components
df`;

      console.log("Setting pandas code with server path:", pandasCode);
      setCode(pandasCode);

      // Force update the data object
      if (data) {
        data.code = pandasCode;
      }
    } catch (error) {
      console.error("Error in handleFileChange:", error);
      setCode("# Error processing file");
    }
  };

  const handleRunCode = () => {
    console.log("Run Code button clicked");
    console.log("code:", code);

    // Ensure code is not undefined or null
    const safeCode = code || "# No code available";

    if (
      !safeCode ||
      safeCode.trim() === "" ||
      safeCode === "# Select a file to generate pandas code"
    ) {
      console.log("No valid code to execute");
      setOutput({
        code: "error",
        content: "No code to execute. Please upload a file first.",
        outputType: "error",
      });
      return;
    }

    // Set executing status
    setOutput({ code: "exec", content: "Executing...", outputType: "exec" });

    try {
      console.log("=== DEBUGGING PYTHON CODE ===");
      console.log("Code being sent to Python interpreter:");
      console.log(safeCode);
      console.log("=== END DEBUG ===");

      // Use PythonInterpreter to execute the code
      pythonInterpreter.current.interpretCode(
        safeCode, // unresolvedUserCode
        safeCode, // userCode
        "", // input (no input for data loading)
        [], // inputTypes
        (result: any) => {
          // Callback function to handle execution result
          console.log("Python execution result:", result);

          if (result.stderr && result.stderr !== "") {
            // Error in execution
            setOutput({
              code: "error",
              content: `Error: ${result.stderr}`,
              outputType: "error",
            });
          } else {
            // Successful execution
            let outputContent = "";
            if (result.stdout) {
              outputContent += "Output:\n" + result.stdout;
            }
            if (result.output && result.output.path) {
              outputContent += "\nSaved to: " + result.output.path;
            }

            setOutput({
              code: "success",
              content: outputContent,
              outputType: "success",
            });

            // Trigger output callback for connected nodes
            if (data.outputCallback && result.output) {
              data.outputCallback(data.nodeId, result.output);
            }
          }
        },
        BoxType.DATA_LOADING, // boxType
        data.nodeId, // nodeId
        workflowNameRef.current || "DefaultWorkflow", // workflow_name
        boxExecProv // boxExecProv for provenance
      );
    } catch (error) {
      console.error("Error executing Python code:", error);
      setOutput({
        code: "error",
        content: `Execution error: ${error}`,
        outputType: "error",
      });
    }
  };

  return (
    <>
      <Handle
        type="source"
        position={Position.Right}
        id="out"
        isConnectable={isConnectable}
      />
      <BoxContainer
        nodeId={data.nodeId}
        data={data}
        output={output}
        templateData={templateData}
        code={code}
        user={user}
        sendCodeToWidgets={sendCode}
        setOutputCallback={setOutput}
        promptModal={promptModal}
        updateTemplate={updateTemplate}
        setTemplateConfig={setTemplateConfig}
        promptDescription={promptDescription}
        disablePlay={true}
      >
        <input
          type="file"
          ref={fileInputRef}
          style={{ display: "none" }}
          onChange={handleFileChange}
        />

        {/* Two buttons: Upload, Run */}
        <div
          style={{
            display: "flex",
            justifyContent: "center",
            gap: "10px",
            marginBottom: "10px",
          }}
        >
          <button
            style={{
              ...buttonStyle,
              display: "flex",
              alignItems: "center",
              gap: "5px",
              padding: "5px 10px",
            }}
            onClick={handleFileClick}
          >
            <FontAwesomeIcon icon={faFileArrowUp} />
            Upload File
          </button>

          <button
            style={{
              ...buttonStyle,
              display: "flex",
              alignItems: "center",
              gap: "5px",
              padding: "5px 10px",
              backgroundColor: filePath ? "#28a745" : "#6c757d",
              cursor: filePath ? "pointer" : "not-allowed",
            }}
            onClick={handleRunCode}
            disabled={!filePath}
          >
            <FontAwesomeIcon icon={faGear} />
            Run Code
          </button>
        </div>

        {/* File information display */}
        {fileInfo && (
          <div
            style={{
              marginBottom: "10px",
              padding: "10px",
              backgroundColor: "#f8f9fa",
              borderRadius: "4px",
              border: "1px solid #dee2e6",
            }}
          >
            <div style={{ marginBottom: "8px" }}>
              <strong>📁 File Information:</strong>
            </div>
            <div style={{ fontSize: "0.9rem", lineHeight: "1.4" }}>
              <div>
                <strong>Name:</strong> {fileInfo.name}
              </div>
              <div>
                <strong>Size:</strong> {(fileInfo.size / 1024).toFixed(2)} KB
              </div>
              <div>
                <strong>Type:</strong> {fileInfo.type}
              </div>
              <div>
                <strong>Last Modified:</strong>{" "}
                {new Date(fileInfo.lastModified).toLocaleString()}
              </div>
            </div>
            <div
              style={{ marginTop: "8px", fontSize: "0.9rem", color: "#666" }}
            >
              <strong>Pandas Code:</strong>{" "}
              <code>pd.read_csv('{fileLink}')</code>
            </div>
          </div>
        )}

        <DescriptionModal
          nodeId={data.nodeId}
          boxType={BoxType.DATA_LOADING}
          name={templateData.name}
          description={templateData.description}
          accessLevel={templateData.accessLevel}
          show={showDescriptionModal}
          handleClose={closeDescription}
          custom={templateData.custom}
        />
        <TemplateModal
          newTemplateFlag={newTemplateFlag}
          templateId={templateData.id}
          callBack={setTemplateConfig}
          show={showTemplateModal}
          handleClose={closeModal}
          boxType={BoxType.DATA_LOADING}
          code={code}
        />

        {/* Code editor, hidden */}
        <div style={{ display: "none" }}>
          {code && (
            <BoxEditor
              setSendCodeCallback={setSendCodeCallback}
              code={true}
              grammar={false}
              widgets={true}
              setOutputCallback={setOutput}
              data={data}
              output={output}
              boxType={BoxType.DATA_LOADING}
              defaultValue={code}
              readOnly={
                templateData.custom != undefined && templateData.custom == false
              }
              floatCode={setCode}
            />
          )}
        </div>

        <OutputIcon type="N" />
      </BoxContainer>
    </>
  );
}

export default DataLoadingBox;
