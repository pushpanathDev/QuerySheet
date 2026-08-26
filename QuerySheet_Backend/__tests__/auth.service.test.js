import { beforeEach, describe, expect, it, jest } from "@jest/globals";

const bcryptHashMock = jest.fn();
const bcryptCompareMock = jest.fn();

const usersWhereGetMock = jest.fn();
const credentialsDocGetMock = jest.fn();
const credentialsDocUpdateMock = jest.fn();
const usersDocUpdateMock = jest.fn();
const authSessionsWhereGetMock = jest.fn();
const authSessionsDocSetMock = jest.fn();

const batchSetMock = jest.fn();
const batchCommitMock = jest.fn();
const firestoreBatchMock = jest.fn(() => ({
  set: batchSetMock,
  commit: batchCommitMock,
}));

const collectionMock = jest.fn((name) => {
  if (name === "users") {
    return {
      where: () => ({
        limit: () => ({
          get: usersWhereGetMock,
        }),
      }),
      doc: () => ({
        update: usersDocUpdateMock,
        collection: () => ({
          doc: () => ({}),
        }),
      }),
    };
  }

  if (name === "userCredentials") {
    return {
      doc: () => ({
        get: credentialsDocGetMock,
        update: credentialsDocUpdateMock,
      }),
    };
  }

  if (name === "authSessions") {
    return {
      where: () => ({
        where: () => ({
          get: authSessionsWhereGetMock,
        }),
      }),
      doc: () => ({
        set: authSessionsDocSetMock,
      }),
    };
  }

  return {
    doc: () => ({}),
  };
});

await jest.unstable_mockModule("bcrypt", () => ({
  default: {
    hash: bcryptHashMock,
    compare: bcryptCompareMock,
  },
}));

await jest.unstable_mockModule("../src/config/firebase.config.js", () => ({
  adminAuth: {
    createUser: jest.fn(),
    deleteUser: jest.fn(),
    generateEmailVerificationLink: jest.fn(),
  },
  db: {
    collection: collectionMock,
    batch: firestoreBatchMock,
  },
}));

const { default: authService, AuthServiceError } = await import(
  "../src/services/auth.service.js"
);

describe("auth.service", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("registerUser throws EMAIL_ALREADY_EXISTS when email exists", async () => {
    usersWhereGetMock.mockResolvedValueOnce({
      empty: false,
      docs: [{ id: "user_1", data: () => ({ uid: "u1" }) }],
    });

    await expect(
      authService.registerUser("test@example.com", "Password123", "Demo User"),
    ).rejects.toMatchObject({
      code: "EMAIL_ALREADY_EXISTS",
    });
  });

  it("loginUser increments failedLoginCount on wrong password", async () => {
    usersWhereGetMock.mockResolvedValueOnce({
      empty: false,
      docs: [
        {
          id: "u1",
          data: () => ({
            uid: "u1",
            email: "test@example.com",
            accountStatus: "active",
            isDeleted: false,
          }),
        },
      ],
    });

    credentialsDocGetMock.mockResolvedValueOnce({
      exists: true,
      data: () => ({
        passwordHash: "hash",
        failedLoginCount: 1,
        lockedUntil: null,
      }),
    });

    bcryptCompareMock.mockResolvedValueOnce(false);

    await expect(
      authService.loginUser("test@example.com", "WrongPassword"),
    ).rejects.toBeInstanceOf(AuthServiceError);

    expect(credentialsDocUpdateMock).toHaveBeenCalled();
  });

  it("loginUser returns ACCOUNT_LOCKED when lockedUntil is in future", async () => {
    usersWhereGetMock.mockResolvedValueOnce({
      empty: false,
      docs: [
        {
          id: "u1",
          data: () => ({
            uid: "u1",
            email: "test@example.com",
            accountStatus: "active",
            isDeleted: false,
          }),
        },
      ],
    });

    credentialsDocGetMock.mockResolvedValueOnce({
      exists: true,
      data: () => ({
        passwordHash: "hash",
        failedLoginCount: 5,
        lockedUntil: {
          toDate: () => new Date(Date.now() + 60_000),
        },
      }),
    });

    await expect(
      authService.loginUser("test@example.com", "Password123"),
    ).rejects.toMatchObject({
      code: "ACCOUNT_LOCKED",
    });
  });

  it("loginUser resets failedLoginCount on success", async () => {
    usersWhereGetMock.mockResolvedValueOnce({
      empty: false,
      docs: [
        {
          id: "u1",
          data: () => ({
            uid: "u1",
            email: "test@example.com",
            displayName: "Demo",
            accountStatus: "active",
            isDeleted: false,
          }),
        },
      ],
    });

    credentialsDocGetMock.mockResolvedValueOnce({
      exists: true,
      data: () => ({
        passwordHash: "hash",
        failedLoginCount: 2,
        lockedUntil: null,
      }),
    });

    authSessionsWhereGetMock.mockResolvedValueOnce({ empty: true, docs: [] });
    bcryptCompareMock.mockResolvedValueOnce(true);

    const result = await authService.loginUser("test@example.com", "Password123");

    expect(result.sessionId).toBeDefined();
    expect(credentialsDocUpdateMock).toHaveBeenCalledWith(
      expect.objectContaining({
        failedLoginCount: 0,
        lockedUntil: null,
      }),
    );
  });
});
