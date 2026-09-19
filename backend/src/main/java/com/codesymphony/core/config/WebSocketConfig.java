package com.codesymphony.core.config;

import org.springframework.context.annotation.Configuration;
import org.springframework.messaging.simp.config.MessageBrokerRegistry;
import org.springframework.web.socket.config.annotation.EnableWebSocketMessageBroker;
import org.springframework.web.socket.config.annotation.StompEndpointRegistry;
import org.springframework.web.socket.config.annotation.WebSocketMessageBrokerConfigurer;

@Configuration
@EnableWebSocketMessageBroker
public class WebSocketConfig implements WebSocketMessageBrokerConfigurer {

  private final CodeSymphonyProperties properties;

  public WebSocketConfig(CodeSymphonyProperties properties) {
    this.properties = properties;
  }

  @Override
  public void configureMessageBroker(MessageBrokerRegistry registry) {
    registry.enableSimpleBroker("/topic", "/queue");
    registry.setApplicationDestinationPrefixes("/app");
    registry.setUserDestinationPrefix("/user");
  }

  @Override
  public void registerStompEndpoints(StompEndpointRegistry registry) {
    String[] origins = CacheConfig.splitOrigins(properties.corsAllowedOrigins());
    // Patterns cover localhost ports and exact production Pages URLs from env.
    String[] patterns = new String[origins.length + 2];
    System.arraycopy(origins, 0, patterns, 0, origins.length);
    patterns[origins.length] = "http://localhost:*";
    patterns[origins.length + 1] = "http://127.0.0.1:*";

    registry.addEndpoint("/ws").setAllowedOriginPatterns(patterns);
    registry.addEndpoint("/ws-sockjs").setAllowedOriginPatterns(patterns).withSockJS();
  }
}
