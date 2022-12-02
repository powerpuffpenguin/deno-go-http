export const Continue = 100; // RFC 7231, 6.2.1
export const SwitchingProtocols = 101; // RFC 7231, 6.2.2
export const Processing = 102; // RFC 2518, 10.1
export const EarlyHints = 103; // RFC 8297

export const OK = 200; // RFC 7231, 6.3.1
export const Created = 201; // RFC 7231, 6.3.2
export const Accepted = 202; // RFC 7231, 6.3.3
export const NonAuthoritativeInfo = 203; // RFC 7231, 6.3.4
export const NoContent = 204; // RFC 7231, 6.3.5
export const ResetContent = 205; // RFC 7231, 6.3.6
export const PartialContent = 206; // RFC 7233, 4.1
export const MultiStatus = 207; // RFC 4918, 11.1
export const AlreadyReported = 208; // RFC 5842, 7.1
export const IMUsed = 226; // RFC 3229, 10.4.1

export const MultipleChoices = 300; // RFC 7231, 6.4.1
export const MovedPermanently = 301; // RFC 7231, 6.4.2
export const Found = 302; // RFC 7231, 6.4.3
export const SeeOther = 303; // RFC 7231, 6.4.4
export const NotModified = 304; // RFC 7232, 4.1
export const UseProxy = 305; // RFC 7231, 6.4.5
export const _ = 306; // RFC 7231, 6.4.6 (Unused)
export const TemporaryRedirect = 307; // RFC 7231, 6.4.7
export const PermanentRedirect = 308; // RFC 7538, 3

export const BadRequest = 400; // RFC 7231, 6.5.1
export const Unauthorized = 401; // RFC 7235, 3.1
export const PaymentRequired = 402; // RFC 7231, 6.5.2
export const Forbidden = 403; // RFC 7231, 6.5.3
export const NotFound = 404; // RFC 7231, 6.5.4
export const MethodNotAllowed = 405; // RFC 7231, 6.5.5
export const NotAcceptable = 406; // RFC 7231, 6.5.6
export const ProxyAuthRequired = 407; // RFC 7235, 3.2
export const RequestTimeout = 408; // RFC 7231, 6.5.7
export const Conflict = 409; // RFC 7231, 6.5.8
export const Gone = 410; // RFC 7231, 6.5.9
export const LengthRequired = 411; // RFC 7231, 6.5.10
export const PreconditionFailed = 412; // RFC 7232, 4.2
export const RequestEntityTooLarge = 413; // RFC 7231, 6.5.11
export const RequestURITooLong = 414; // RFC 7231, 6.5.12
export const UnsupportedMediaType = 415; // RFC 7231, 6.5.13
export const RequestedRangeNotSatisfiable = 416; // RFC 7233, 4.4
export const ExpectationFailed = 417; // RFC 7231, 6.5.14
export const Teapot = 418; // RFC 7168, 2.3.3
export const MisdirectedRequest = 421; // RFC 7540, 9.1.2
export const UnprocessableEntity = 422; // RFC 4918, 11.2
export const Locked = 423; // RFC 4918, 11.3
export const FailedDependency = 424; // RFC 4918, 11.4
export const TooEarly = 425; // RFC 8470, 5.2.
export const UpgradeRequired = 426; // RFC 7231, 6.5.15
export const PreconditionRequired = 428; // RFC 6585, 3
export const TooManyRequests = 429; // RFC 6585, 4
export const RequestHeaderFieldsTooLarge = 431; // RFC 6585, 5
export const UnavailableForLegalReasons = 451; // RFC 7725, 3

export const InternalServerError = 500; // RFC 7231, 6.6.1
export const NotImplemented = 501; // RFC 7231, 6.6.2
export const BadGateway = 502; // RFC 7231, 6.6.3
export const ServiceUnavailable = 503; // RFC 7231, 6.6.4
export const GatewayTimeout = 504; // RFC 7231, 6.6.5
export const HTTPVersionNotSupported = 505; // RFC 7231, 6.6.6
export const VariantAlsoNegotiates = 506; // RFC 2295, 8.1
export const InsufficientStorage = 507; // RFC 4918, 11.5
export const LoopDetected = 508; // RFC 5842, 7.2
export const NotExtended = 510; // RFC 2774, 7
export const NetworkAuthenticationRequired = 511; // RFC 6585, 6

export function statusText(status: number): string {
  switch (status) {
    case Continue:
      return "Continue";
    case SwitchingProtocols:
      return "Switching Protocols";
    case Processing:
      return "Processing";
    case EarlyHints:
      return "Early Hints";

    case OK:
      return "OK";
    case Created:
      return "Created";
    case Accepted:
      return "Accepted";
    case NonAuthoritativeInfo:
      return "Non-Authoritative Information";
    case NoContent:
      return "No Content";
    case ResetContent:
      return "Reset Content";
    case PartialContent:
      return "Partial Content";
    case MultiStatus:
      return "Multi-Status";
    case AlreadyReported:
      return "Already Reported";
    case IMUsed:
      return "IM Used";

    case MultipleChoices:
      return "Multiple Choices";
    case MovedPermanently:
      return "Moved Permanently";
    case Found:
      return "Found";
    case SeeOther:
      return "See Other";
    case NotModified:
      return "Not Modified";
    case UseProxy:
      return "Use Proxy";
    case TemporaryRedirect:
      return "Temporary Redirect";
    case PermanentRedirect:
      return "Permanent Redirect";

    case BadRequest:
      return "Bad Request";
    case Unauthorized:
      return "Unauthorized";
    case PaymentRequired:
      return "Payment Required";
    case Forbidden:
      return "Forbidden";
    case NotFound:
      return "Not Found";
    case MethodNotAllowed:
      return "Method Not Allowed";
    case NotAcceptable:
      return "Not Acceptable";
    case ProxyAuthRequired:
      return "Proxy Authentication Required";
    case RequestTimeout:
      return "Request Timeout";
    case Conflict:
      return "Conflict";
    case Gone:
      return "Gone";
    case LengthRequired:
      return "Length Required";
    case PreconditionFailed:
      return "Precondition Failed";
    case RequestEntityTooLarge:
      return "Request Entity Too Large";
    case RequestURITooLong:
      return "Request URI Too Long";
    case UnsupportedMediaType:
      return "Unsupported Media Type";
    case RequestedRangeNotSatisfiable:
      return "Requested Range Not Satisfiable";
    case ExpectationFailed:
      return "Expectation Failed";
    case Teapot:
      return "I'm a teapot";
    case MisdirectedRequest:
      return "Misdirected Request";
    case UnprocessableEntity:
      return "Unprocessable Entity";
    case Locked:
      return "Locked";
    case FailedDependency:
      return "Failed Dependency";
    case TooEarly:
      return "Too Early";
    case UpgradeRequired:
      return "Upgrade Required";
    case PreconditionRequired:
      return "Precondition Required";
    case TooManyRequests:
      return "Too Many Requests";
    case RequestHeaderFieldsTooLarge:
      return "Request Header Fields Too Large";
    case UnavailableForLegalReasons:
      return "Unavailable For Legal Reasons";

    case InternalServerError:
      return "Internal Server Error";
    case NotImplemented:
      return "Not Implemented";
    case BadGateway:
      return "Bad Gateway";
    case ServiceUnavailable:
      return "Service Unavailable";
    case GatewayTimeout:
      return "Gateway Timeout";
    case HTTPVersionNotSupported:
      return "HTTP Version Not Supported";
    case VariantAlsoNegotiates:
      return "Variant Also Negotiates";
    case InsufficientStorage:
      return "Insufficient Storage";
    case LoopDetected:
      return "Loop Detected";
    case NotExtended:
      return "Not Extended";
    case NetworkAuthenticationRequired:
      return "Network Authentication Required";
  }
  return "";
}
