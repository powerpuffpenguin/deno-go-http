export class Status {
  constructor(
    public readonly code: number,
    public readonly text: string,
  ) {}

  static Continue = new Status(100, "Continue"); // RFC 7231, 6.2.1
  static SwitchingProtocols = new Status(101, "Switching Protocols"); // RFC 7231, 6.2.2
  static Processing = new Status(102, "Processing"); // RFC 2518, 10.1
  static EarlyHints = new Status(103, "Early Hints"); // RFC 8297

  static OK = new Status(200, "OK"); // RFC 7231, 6.3.1
  static Created = new Status(201, "Created"); // RFC 7231, 6.3.2
  static Accepted = new Status(202, "Accepted"); // RFC 7231, 6.3.3
  static NonAuthoritativeInfo = new Status(
    203,
    "Non-Authoritative Information",
  ); // RFC 7231, 6.3.4
  static NoContent = new Status(204, "No Content"); // RFC 7231, 6.3.5
  static ResetContent = new Status(205, "Reset Content"); // RFC 7231, 6.3.6
  static PartialContent = new Status(206, "Partial Content"); // RFC 7233, 4.1
  static MultiStatus = new Status(207, "Multi-Status"); // RFC 4918, 11.1
  static AlreadyReported = new Status(208, "Already Reported"); // RFC 5842, 7.1
  static IMUsed = new Status(226, "IM Used"); // RFC 3229, 10.4.1

  static MultipleChoices = new Status(300, "Multiple Choices"); // RFC 7231, 6.4.1
  static MovedPermanently = new Status(301, "Moved Permanently"); // RFC 7231, 6.4.2
  static Found = new Status(302, "Found"); // RFC 7231, 6.4.3
  static SeeOther = new Status(303, "See Other"); // RFC 7231, 6.4.4
  static NotModified = new Status(304, "Not Modified"); // RFC 7232, 4.1
  static UseProxy = new Status(305, "Use Proxy"); // RFC 7231, 6.4.5
  _ = new Status(306, "Use Proxy"); // RFC 7231, 6.4.6 (Unused)
  static TemporaryRedirect = new Status(307, "Temporary Redirect"); // RFC 7231, 6.4.7
  static PermanentRedirect = new Status(308, "Permanent Redirect"); // RFC 7538, 3

  static BadRequest = new Status(400, "Bad Request"); // RFC 7231, 6.5.1
  static Unauthorized = new Status(401, "Unauthorized"); // RFC 7235, 3.1
  static PaymentRequired = new Status(402, "Payment Required"); // RFC 7231, 6.5.2
  static Forbidden = new Status(403, "Forbidden"); // RFC 7231, 6.5.3
  static NotFound = new Status(404, "Not Found"); // RFC 7231, 6.5.4
  static MethodNotAllowed = new Status(405, "Method Not Allowed"); // RFC 7231, 6.5.5
  static NotAcceptable = new Status(406, "Not Acceptable"); // RFC 7231, 6.5.6
  static ProxyAuthRequired = new Status(407, "Proxy Authentication Required"); // RFC 7235, 3.2
  static RequestTimeout = new Status(408, "Request Timeout"); // RFC 7231, 6.5.7
  static Conflict = new Status(409, "Conflict"); // RFC 7231, 6.5.8
  static Gone = new Status(410, "Gone"); // RFC 7231, 6.5.9
  static LengthRequired = new Status(411, "Length Required"); // RFC 7231, 6.5.10
  static PreconditionFailed = new Status(412, "Precondition Failed"); // RFC 7232, 4.2
  static RequestEntityTooLarge = new Status(413, "Request Entity Too Large"); // RFC 7231, 6.5.11
  static RequestURITooLong = new Status(414, "Request URI Too Long"); // RFC 7231, 6.5.12
  static UnsupportedMediaType = new Status(415, "Unsupported Media Type"); // RFC 7231, 6.5.13
  static RequestedRangeNotSatisfiable = new Status(
    416,
    "Requested Range Not Satisfiable",
  ); // RFC 7233, 4.4
  static ExpectationFailed = new Status(417, "Expectation Failed"); // RFC 7231, 6.5.14
  static Teapot = new Status(418, "I'm a teapot"); // RFC 7168, 2.3.3
  static MisdirectedRequest = new Status(421, "Misdirected Request"); // RFC 7540, 9.1.2
  static UnprocessableEntity = new Status(422, "Unprocessable Entity"); // RFC 4918, 11.2
  static Locked = new Status(423, "Locked"); // RFC 4918, 11.3
  static FailedDependency = new Status(424, "Failed Dependency"); // RFC 4918, 11.4
  static TooEarly = new Status(425, "Too Early"); // RFC 8470, 5.2.
  static UpgradeRequired = new Status(426, "Upgrade Required"); // RFC 7231, 6.5.15
  static PreconditionRequired = new Status(428, "Precondition Required"); // RFC 6585, 3
  static TooManyRequests = new Status(429, "Too Many Requests"); // RFC 6585, 4
  static RequestHeaderFieldsTooLarge = new Status(
    431,
    "Request Header Fields Too Large",
  ); // RFC 6585, 5
  static UnavailableForLegalReasons = new Status(
    451,
    "Unavailable For Legal Reasons",
  ); // RFC 7725, 3

  static InternalServerError = new Status(500, "Internal Server Error"); // RFC 7231, 6.6.1
  static NotImplemented = new Status(501, "Not Implemented"); // RFC 7231, 6.6.2
  static BadGateway = new Status(502, "Bad Gateway"); // RFC 7231, 6.6.3
  static ServiceUnavailable = new Status(503, "Service Unavailable"); // RFC 7231, 6.6.4
  static GatewayTimeout = new Status(504, "Gateway Timeout"); // RFC 7231, 6.6.5
  static HTTPVersionNotSupported = new Status(
    505,
    "HTTP Version Not Supported",
  ); // RFC 7231, 6.6.6
  static VariantAlsoNegotiates = new Status(506, "Variant Also Negotiates"); // RFC 2295, 8.1
  static InsufficientStorage = new Status(507, "Insufficient Storage"); // RFC 4918, 11.5
  static LoopDetected = new Status(508, "Loop Detected"); // RFC 5842, 7.2
  static NotExtended = new Status(510, "Not Extended"); // RFC 2774, 7
  static NetworkAuthenticationRequired = new Status(
    511,
    "Network Authentication Required",
  ); // RFC 6585, 6

  with(text: string): Status {
    return new Status(this.code, text);
  }
  toString(): string {
    if (this.text != "") {
      return `status=${this.code} text=${this.text}`;
    }
    return `status=${this.code}`;
  }
}
