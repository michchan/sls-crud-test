import { APIGatewayProxyHandler, APIGatewayProxyResult } from 'aws-lambda';
import 'source-map-support/register';
import { DynamoDB, AWSError } from 'aws-sdk'
import uuid from 'uuid/v4'
import { GetItemInput, UpdateItemInput, DeleteItemInput } from 'aws-sdk/clients/dynamodb';


const db = new DynamoDB.DocumentClient({ apiVersion: '2012-08-10' })

const postsTable = process.env.POSTS_TABLE

// Post schema
export interface Post {
  id: string;
  createdAt: string;
  userId: number;
  title: string;
  body: string;
}

// Post form data
export interface FormData extends Pick<Post, 'title' | 'body'> {}

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
 * Sort by date
 */
function sortByDate (a: Post, b: Post) {
  if (a.createdAt > b.createdAt) {
    return -1
  }
  return 1
}

/**
 * Create a new post
 */
export const createPost: APIGatewayProxyHandler = async (event) => {
  // Parse request body
  const reqBody: FormData = JSON.parse(event.body)
  // Validate request body
  if (!reqBody.title || reqBody.title.trim() === '' || !reqBody.body || reqBody.body.trim() === '') {
    return response(400, { error: 'Post must have a title and body and they must not be empty string.' })
  }
  // Create a new post data
  const post: Post = {
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
    }).promise()
    // Respond successfully
    return response(201, post)
  } catch (error) {
    // Respond failed
    return response((error as AWSError).statusCode, error)
  }
}

/**
 * Get a handler to scan a number of posts and response with data
 */
const getScanPostsHandler = (limit?: number): APIGatewayProxyHandler => async () => {
  try {
    // Scan records
    const res = await db.scan({
      TableName: postsTable,
      Limit: limit,
    }).promise()   
    // Respond successfully
    return response(200, res.Items.sort(sortByDate))
  } catch (error) {
    // Respond failed
    return response((error as AWSError).statusCode, error)
  }
}

/**
 * Get all posts
 */
export const getAllPosts: APIGatewayProxyHandler = (...args) => {
  return getScanPostsHandler()(...args)
}

export interface PluralPathParams {
  number: number;
}

/**
 * Get a number of posts
 */
export const getPosts: APIGatewayProxyHandler = (event, ...args) => {
  // Parse number of posts path param
  const numPosts = (event.pathParameters as unknown as PluralPathParams).number;
  return getScanPostsHandler(numPosts)(event, ...args)
}

export interface SinglePathParams {
  id: string;
}

/**
 * Get a single post
 */
export const getPost = async (event, ...args) => {
  // Parse id path param
  const id = (event.pathParameters as unknown as SinglePathParams).id;
  // Create db.get params
  const params: GetItemInput = {
    Key: { id } as GetItemInput['Key'],
    TableName: postsTable,
  }
  // Process
  try {
    // Get item from db
    const res = await db.get(params).promise()
    if (res.Item) {
      return response(200, res.Item)
    } else {
      return response(404, { error: 'Post not found' })
    }
  } catch (error) {
      return response((error as AWSError).statusCode, error)
  }
}

/**
 * Update a post
 */
export const updatePost: APIGatewayProxyHandler = async (event) => {
  // Parse id path param
  const id = (event.pathParameters as unknown as SinglePathParams).id;
  // Parse body
  const eventBody: Partial<FormData> = JSON.parse(event.body)
  const { title, body } = eventBody
  // Create db.update params
  const params: UpdateItemInput = {
    Key: { id } as UpdateItemInput['Key'],
    TableName: postsTable,
    ConditionExpression: 'attribute_exists(id)',
    UpdateExpression: `
      SET title = :title,
      SET body = :body
    `,
    ExpressionAttributeValues: {
      title,
      body,
    } as UpdateItemInput['ExpressionAttributeValues'],
    ReturnValues: 'ALL_NEW'
  }
  // Process
  try {
    // Update the item in db
    const res = await db.update(params).promise()
    return response(200, res)
  } catch (error) {
    return response((error as AWSError).statusCode, error)
  }
}

/**
 * Delete a post
 */
export const deletePost: APIGatewayProxyHandler = async (event) => {
  // Parse id path param
  const id = (event.pathParameters as unknown as SinglePathParams).id;
  // Create db.update params
  const params: DeleteItemInput = {
    Key: { id } as DeleteItemInput['Key'],
    TableName: postsTable,
  }
  // Process
  try {
    // Update the item in db
    await db.delete(params).promise()
    return response(200, { message: 'Post deleted successfully' })
  } catch (error) {
    return response((error as AWSError).statusCode, error)
  }
}