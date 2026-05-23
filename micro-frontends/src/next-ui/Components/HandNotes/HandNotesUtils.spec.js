import axios from "axios";
import { SAVE_DOCUMENT_URL } from "../../constants";
import { saveDocument } from "./HandNotesUtils";

jest.mock("axios");

describe("save document", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });
  const payload = {filename: "file name", patientUuid: "patient uuid", content: "content"};
  const savedImageUrl = { url: "openmrs/image.png" };

  it("should return url of saved image when status is 200", async () => {
    const mockResponse = { status: 200, data: savedImageUrl };
    axios.post.mockResolvedValueOnce(mockResponse);

    const result = await saveDocument(payload);

    expect(result).toEqual(mockResponse);
    expect(axios.post).toHaveBeenCalledTimes(1);
  });


  it("should handle error when fetching form detail", async () => {
    const errorMessage = "Failed to dave document";
    axios.post.mockRejectedValueOnce(new Error(errorMessage));
    try {
        await saveDocument({});
    } catch (error) {
        expect(error.message).toBe(errorMessage);
    }
    expect(axios.post).toHaveBeenCalledTimes(1);
  });
});