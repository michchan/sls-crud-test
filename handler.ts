import { APIGatewayProxyHandler, APIGatewayProxyResult } from 'aws-lambda';
import 'source-map-support/register';
import { DynamoDB, AWSError } from 'aws-sdk'
import uuid from 'uuid/v4'

const db = new DynamoDB.DocumentClient({ apiVersion: '2012-08-10' })

const postsTable = process.env.POSTS_TABLE

/**
 * Create response
 */
function response <M = unknown> (statusCode: number, message: M): APIGatewayProxyResult {
  return {
    statusCode,
    body: JSON.stringify(message)
  }
}

/**
 * Create a new post
 */
export const createPost: APIGatewayProxyHandler = async (event) => {
  // Parse request body
  const reqBody = JSON.parse(event.body)
  // Create a new post data
  const post = {
    id: uuid(),
    createdAt: new Date().toISOString(),
    userId: 1,
    title: reqBody.title,
    body: reqBody.body,
  }
  // Process
  try {
    // Insert into db
    await db.put({
      TableName: postsTable,
      Item: post,
    })
    // Response successfully
    return response(201, post)
  } catch (error) {
    return response((error as AWSError).statusCode, error)
  }
}