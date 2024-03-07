<!-- $Header: health.jsp 1.00XG 2018/09/01 11:15:00 degelx netscaler $ -->
<%@ page
  pageEncoding="ISO-8859-1"
  session="false"
  language="java"
  import="java.net.InetAddress,java.util.Date"
%>

<HTML>
<BODY>
<font face="Lucida Console, Courier New" size="2">
<%
java.util.Date date = new java.util.Date();

out.println( "<br><i>SYSTEM_DATE</i> | " + String.valueOf( date ));
out.println( "<br><i>AUTH_TYPE      </i> | " + request.getAuthType() );
out.println( "<br><i>CONTENT_LENGTH </i> | " + String.valueOf(request.getContentLength()) );
out.println( "<br><i>CONTENT_TYPE   </i> | " + request.getContentType() );
out.println( "<br><i>DOCUMENT_ROOT  </i> | " + getServletContext().getRealPath("/") );
out.println( "<br><i>PATH_INFO      </i> | " + request.getPathInfo() );
out.println( "<br><i>PATH_TRANSLATED</i> | " + request.getPathTranslated() );
out.println( "<br><i>QUERY_STRING   </i> | " + request.getQueryString() );
out.println( "<br><i>REMOTE_ADDR    </i> | " + request.getRemoteAddr() );
out.println( "<br><i>REMOTE_HOST    </i> | " + request.getRemoteHost() );
out.println( "<br><i>REMOTE_XFWR    </i> | " + request.getHeader("X-Forwarded-For") );
out.println( "<br><i>REMOTE_USER    </i> | " + request.getRemoteUser() );
out.println( "<br><i>REQUEST_METHOD </i> | " + request.getMethod() );
out.println( "<br><i>SCRIPT_NAME    </i> | " + request.getServletPath() );
out.println( "<br><i>SERVER_NAME    </i> | " + request.getServerName() );
out.println( "<br><i>SERVER_ADDR    </i> | " + InetAddress.getLocalHost() );
out.println( "<br><i>SERVER_PORT    </i> | " + String.valueOf(request.getServerPort()) );
out.println( "<br><i>SERVER_PROTOCOL</i> | " + request.getProtocol() );
out.println( "<br><i>SERVER_SOFTWARE</i> | " + getServletContext().getServerInfo() );
out.println( "<br><i>JAVA_CLASSPATH </i> | " + System.getProperty("java.class.path") );
out.println( "<br><i>JAVA_VM_VERSION</i> | " + System.getProperty("java.vm.version") );
out.println( "<br><i>JAVA_VERSION   </i> | " + System.getProperty("java.version") );
%>
</font>
</BODY>
</HTML>
